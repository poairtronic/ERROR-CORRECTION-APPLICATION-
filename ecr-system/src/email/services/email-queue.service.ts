import {
  Injectable,
  Logger,
  BeforeApplicationShutdown,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { Repository } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { runWithTraceContext, getCorrelationId } from '../../common/trace-context';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { PerformanceService } from '../../monitoring/performance.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailQueueService implements BeforeApplicationShutdown, OnModuleInit {
  static readonly FALLBACK_CRON_NAME = 'email-queue-fallback';

  private readonly logger = new Logger(EmailQueueService.name);
  private readonly maxRetries = 3; // Up to 3 scheduled retries after the initial attempt
  private readonly retryDelays = [2, 5, 15]; // Delays in seconds for retryCount 1, 2, 3
  private readonly batchSize = 5;
  private readonly batchWindowMs = 12000;
  private readonly defaultStuckThresholdMs = 10 * 60 * 1000;

  private isProcessing = false;
  private pendingRescan = false;
  private isShuttingDown = false;
  private nextTimer: NodeJS.Timeout | null = null;
  private nextTimerRunAt: number | null = null;
  private startupImmediate: NodeJS.Immediate | null = null;
  private lastBatchCompletedAt = 0;
  private readonly activeAbortControllers = new Set<AbortController>();

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private emailService: EmailService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private monitoringService: MonitoringService,
    private performanceService: PerformanceService,
    @Optional() private readonly schedulerRegistry?: SchedulerRegistry,
  ) { }

  async onModuleInit() {
    if (this.isShuttingDown) {
      return;
    }

    this.registerFallbackCron();

    // Run startup recovery and initial flush asynchronously so HTTP binding is never blocked.
    this.startupImmediate = setImmediate(() => {
      this.startupImmediate = null;
      void this.runStartupRecoveryAndFlush();
    });
  }

  private async runStartupRecoveryAndFlush(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const stuckRecovered = await this.recoverStuckProcessingEmails();
      if (stuckRecovered > 0) {
        this.logger.log(`[EMAIL_RECOVERY] Recovered ${stuckRecovered} stuck PROCESSING emails on startup.`);
      }

      const recovered = await this.recoverGasQuotaExceededEmails();
      if (recovered > 0) {
        this.logger.log(`[EMAIL_RECOVERY] Re-queued ${recovered} GAS quota-limited emails on startup.`);
      }

      if (!this.isShuttingDown) {
        await this.processEmailQueue();
      }
    } catch (err: any) {
      this.logger.warn(`[EMAIL_RECOVERY] Startup email recovery notice: ${err?.message || err}`);
    }
  }

  private registerFallbackCron(): void {
    if (!this.schedulerRegistry || this.isShuttingDown) {
      return;
    }

    const configuredCron =
      this.configService?.get<string>('EMAIL_QUEUE_CRON') ||
      process.env.EMAIL_QUEUE_CRON ||
      CronExpression.EVERY_30_MINUTES;

    const jobName = EmailQueueService.FALLBACK_CRON_NAME;
    try {
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        this.schedulerRegistry.deleteCronJob(jobName);
      }

      let job: CronJob;
      try {
        job = new CronJob(configuredCron, () => {
          void this.handleFallbackCron();
        });
      } catch (cronError: any) {
        this.logger.error(
          `[EMAIL_DIAGNOSTICS] Invalid EMAIL_QUEUE_CRON "${configuredCron}" (${cronError?.message}); falling back to ${CronExpression.EVERY_30_MINUTES}.`,
        );
        job = new CronJob(CronExpression.EVERY_30_MINUTES, () => {
          void this.handleFallbackCron();
        });
      }

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
    } catch (err: any) {
      this.logger.warn(`[EMAIL_DIAGNOSTICS] Failed to register fallback cron job: ${err?.message || err}`);
    }
  }

  /**
   * Periodic safety-net runner (every 30m by default):
   * recovers orphaned PROCESSING rows before flushing any missed events.
   */
  async handleFallbackCron(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    try {
      const stuckRecovered = await this.recoverStuckProcessingEmails();
      if (stuckRecovered > 0) {
        this.logger.warn(`[EMAIL_RECOVERY] Recovered ${stuckRecovered} stuck PROCESSING emails during periodic sweep.`);
      }
    } catch (err: any) {
      this.logger.warn(`[EMAIL_RECOVERY] Periodic stuck-job sweep failed: ${err?.message || err}`);
    }

    if (!this.isShuttingDown) {
      await this.processEmailQueue();
    }
  }

  /**
   * Atomically recovers jobs stuck in PROCESSING longer than threshold using PostgreSQL server time.
   * Exhausted jobs are transitioned to CANCELLED; remaining jobs are moved to FAILED with incremented retryCount.
   */
  async recoverStuckProcessingEmails(stuckThresholdMs?: number): Promise<number> {
    const rawThreshold =
      typeof stuckThresholdMs === 'number'
        ? stuckThresholdMs
        : Number(
          this.configService?.get<string>('EMAIL_STUCK_THRESHOLD_MS') ||
          process.env.EMAIL_STUCK_THRESHOLD_MS ||
          this.defaultStuckThresholdMs,
        );

    const effectiveThresholdMs =
      Number.isFinite(rawThreshold) && rawThreshold >= 0 ? rawThreshold : this.defaultStuckThresholdMs;

    const exhaustedResult = await this.emailLogRepo
      .createQueryBuilder()
      .update(EmailLog)
      .set({
        status: EmailStatus.CANCELLED,
        retryCount: () => '"retryCount" + 1',
        failureReason: 'Recovered stuck PROCESSING state after exceeding max retries',
        updatedAt: () => 'clock_timestamp()',
      })
      .where('status = :processingStatus', { processingStatus: EmailStatus.PROCESSING })
      .andWhere('"updatedAt" < clock_timestamp() - (:thresholdMs * interval \'1 millisecond\')', {
        thresholdMs: effectiveThresholdMs,
      })
      .andWhere('"retryCount" >= :maxRetries', { maxRetries: this.maxRetries })
      .execute();

    const retryableResult = await this.emailLogRepo
      .createQueryBuilder()
      .update(EmailLog)
      .set({
        status: EmailStatus.FAILED,
        retryCount: () => '"retryCount" + 1',
        failureReason: 'Recovered from stuck PROCESSING state for retry',
        updatedAt: () => 'clock_timestamp()',
      })
      .where('status = :processingStatus', { processingStatus: EmailStatus.PROCESSING })
      .andWhere('"updatedAt" < clock_timestamp() - (:thresholdMs * interval \'1 millisecond\')', {
        thresholdMs: effectiveThresholdMs,
      })
      .andWhere('"retryCount" < :maxRetries', { maxRetries: this.maxRetries })
      .execute();

    return (exhaustedResult?.affected || 0) + (retryableResult?.affected || 0);
  }

  /**
   * Atomically resets only explicit Google Apps Script quota-exhausted failures back to PENDING.
   */
  async recoverGasQuotaExceededEmails(): Promise<number> {
    const result = await this.emailLogRepo
      .createQueryBuilder()
      .update(EmailLog)
      .set({
        status: EmailStatus.PENDING,
        retryCount: 0,
        failureReason: null as unknown as string,
        updatedAt: () => 'clock_timestamp()',
      })
      .where('status IN (:...statuses)', { statuses: [EmailStatus.FAILED, EmailStatus.CANCELLED] })
      .andWhere('("failureReason" ILIKE :msg1 OR "failureReason" ILIKE :msg2 OR "failureReason" ILIKE :msg3)', {
        msg1: '%Service invoked too many times%',
        msg2: '%quota exceeded%',
        msg3: '%Limit Exceeded%',
      })
      .execute();

    const recoveredCount = result?.affected || 0;
    if (recoveredCount > 0) {
      this.eventEmitter.emit('email.logs.updated');
    }
    return recoveredCount;
  }

  /**
   * Coalesces queue wakeup scheduling onto a single earliest in-memory timer.
   */
  scheduleQueueWakeup(delayMs: number): void {
    if (this.isShuttingDown) {
      return;
    }

    const safeDelayMs = Math.max(0, Math.round(delayMs));
    const targetRunAt = Date.now() + safeDelayMs;

    if (this.nextTimer && this.nextTimerRunAt !== null && this.nextTimerRunAt <= targetRunAt) {
      return;
    }

    if (this.nextTimer) {
      clearTimeout(this.nextTimer);
      this.nextTimer = null;
      this.nextTimerRunAt = null;
    }

    this.nextTimerRunAt = targetRunAt;
    this.nextTimer = setTimeout(() => {
      this.nextTimer = null;
      this.nextTimerRunAt = null;
      if (!this.isShuttingDown) {
        void this.processEmailQueue();
      }
    }, safeDelayMs);
  }

  /**
   * Schedule an in-memory retry execution for transient failures.
   */
  scheduleRetry(delaySeconds: number): void {
    this.scheduleQueueWakeup(Math.max(0, delaySeconds) * 1000);
  }

  /**
   * Schedule subsequent batch processing when more than batchSize emails are eligible.
   */
  scheduleBatchContinuation(delayMs = this.batchWindowMs): void {
    this.scheduleQueueWakeup(delayMs);
  }

  clearScheduledTimers(): void {
    if (this.startupImmediate) {
      clearImmediate(this.startupImmediate);
      this.startupImmediate = null;
    }
    if (this.nextTimer) {
      clearTimeout(this.nextTimer);
      this.nextTimer = null;
    }
    this.nextTimerRunAt = null;
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.logger.log('Graceful shutdown initiated. Preventing new queue jobs and draining current email queue tasks...');
    this.isShuttingDown = true;
    this.pendingRescan = false;
    this.clearScheduledTimers();

    try {
      const jobName = EmailQueueService.FALLBACK_CRON_NAME;
      if (this.schedulerRegistry?.doesExist('cron', jobName)) {
        const job = this.schedulerRegistry.getCronJob?.(jobName);
        job?.stop?.();
        this.schedulerRegistry.deleteCronJob(jobName);
      }
    } catch {
      // Scheduler already stopped or unavailable in unit test context
    }

    const shutdownTimeoutMs = 8000;
    const started = Date.now();
    while (this.isProcessing && Date.now() - started < shutdownTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!this.isProcessing) {
      this.logger.log('Email queue drained successfully.');
      return;
    }

    this.logger.warn(
      `Email queue drain timed out after ${shutdownTimeoutMs}ms; aborting ${this.activeAbortControllers.size} in-flight request(s).`,
    );
    for (const controller of this.activeAbortControllers) {
      controller.abort();
    }

    const settleDeadline = Date.now() + 500;
    while (this.isProcessing && Date.now() < settleDeadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    if (this.isProcessing) {
      this.logger.warn('Email queue shutdown completed with active send loop still unwinding.');
    } else {
      this.logger.log('Email queue unwound cleanly after aborting in-flight requests.');
    }
  }

  private async acquireClusterBatchSlots(
    requestedCount: number,
  ): Promise<{ grantedSlots: number; retryAfterMs: number }> {
    const safeRequested = Math.max(0, Math.min(this.batchSize, requestedCount));
    if (safeRequested === 0) {
      return { grantedSlots: 0, retryAfterMs: this.batchWindowMs };
    }

    const fallbackLocal = (): { grantedSlots: number; retryAfterMs: number } => {
      if (this.lastBatchCompletedAt > 0) {
        const elapsed = Date.now() - this.lastBatchCompletedAt;
        if (elapsed < this.batchWindowMs) {
          return { grantedSlots: 0, retryAfterMs: Math.max(250, this.batchWindowMs - elapsed) };
        }
      }
      return { grantedSlots: safeRequested, retryAfterMs: this.batchWindowMs };
    };

    if (typeof this.emailLogRepo?.manager?.query !== 'function') {
      return fallbackLocal();
    }

    try {
      const rows = await this.emailLogRepo.manager.query(
        `
        WITH current_state AS (
          SELECT "key", "windowStart", "dispatchedCount"
          FROM "email_rate_limit_state"
          WHERE "key" = 'global'
          FOR UPDATE
        ),
        calc AS (
          SELECT
            "key",
            CASE
              WHEN clock_timestamp() - "windowStart" >= ($1::int * interval '1 millisecond') THEN 0
              ELSE "dispatchedCount"
            END AS effective_used,
            CASE
              WHEN clock_timestamp() - "windowStart" >= ($1::int * interval '1 millisecond') THEN clock_timestamp()
              ELSE "windowStart"
            END AS next_window_start,
            GREATEST(
              0,
              CEIL(EXTRACT(EPOCH FROM (("windowStart" + ($1::int * interval '1 millisecond')) - clock_timestamp())) * 1000)
            )::int AS retry_after_ms
          FROM current_state
        ),
        updated AS (
          UPDATE "email_rate_limit_state" r
          SET
            "windowStart" = calc.next_window_start,
            "dispatchedCount" = LEAST($2::int, calc.effective_used + $3::int)
          FROM calc
          WHERE r."key" = calc."key"
            AND calc.effective_used < $2::int
          RETURNING
            LEAST($3::int, $2::int - calc.effective_used)::int AS granted_slots,
            $1::int AS next_retry_after_ms
        )
        SELECT
          COALESCE((SELECT granted_slots FROM updated), 0)::int AS "grantedSlots",
          COALESCE((SELECT next_retry_after_ms FROM updated), (SELECT retry_after_ms FROM calc), $1::int)::int AS "retryAfterMs"
        `,
        [this.batchWindowMs, this.batchSize, safeRequested],
      );

      const row = Array.isArray(rows) ? rows[0] : undefined;
      const grantedSlots = Number(row?.grantedSlots ?? 0);
      const retryAfterMs = Number(row?.retryAfterMs ?? this.batchWindowMs);
      return {
        grantedSlots: Number.isFinite(grantedSlots) ? Math.max(0, grantedSlots) : 0,
        retryAfterMs: Number.isFinite(retryAfterMs) ? Math.max(250, retryAfterMs) : this.batchWindowMs,
      };
    } catch (err: any) {
      this.logger.warn(
        `[EMAIL_RATE_LIMIT_WARN] Cluster rate-limit lease failed (${err?.message || err}); falling back to local window guard.`,
      );
      return fallbackLocal();
    }
  }

  private async abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted || this.isShuttingDown) {
      return;
    }
    await new Promise<void>((resolve) => {
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        resolve();
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Primary email queue processor.
   * - Event-driven: Wakes immediately on 'email.logs.updated' when an email is queued/updated.
   * - Coalesces overlapping triggers via pendingRescan instead of dropping events.
   * - Atomic DB claim and conditional state persistence protect against multi-instance overwrites.
   */
  @OnEvent('email.logs.updated')
  async processEmailQueue(): Promise<void> {
    const traceCtx = {
      correlationId: `cron-email-queue-${crypto.randomUUID()}`,
      requestId: crypto.randomUUID(),
    };

    return runWithTraceContext(traceCtx, async () => {
      if (this.isShuttingDown) {
        this.logger.log('Process queue requested but system is shutting down. Skipping execution.');
        return;
      }
      if (this.isProcessing) {
        this.pendingRescan = true;
        this.logger.debug('Email queue already processing; flagged pendingRescan.');
        return;
      }

      this.isProcessing = true;
      const startTime = Date.now();
      let processedAnyBatch = false;

      try {
        console.log('[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Polling email queue...');

        let emailsToProcess: EmailLog[];
        try {
          emailsToProcess = await this.emailLogRepo.find({
            where: [{ status: EmailStatus.PENDING }, { status: EmailStatus.FAILED }],
            order: { createdAt: 'ASC' },
            take: 100,
          });
        } catch (error: any) {
          console.error(
            `[EMAIL_DIAGNOSTICS] [FAILURE] Failed to query pending emails from database.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: processEmailQueue\nStack: ${error.stack}`,
          );
          throw error;
        }

        const eligibleEmails: EmailLog[] = [];
        let minRetryDelayNeeded: number | null = null;

        for (const email of emailsToProcess) {
          if (email.status === EmailStatus.PENDING) {
            eligibleEmails.push(email);
          } else if (email.status === EmailStatus.FAILED) {
            const delayIdx = Math.max(0, Math.min(this.retryDelays.length - 1, (email.retryCount || 1) - 1));
            const requiredDelay = this.retryDelays[delayIdx] || 15;
            const updatedAtMs = email.updatedAt ? new Date(email.updatedAt).getTime() : 0;
            const secondsPassed = (Date.now() - updatedAtMs) / 1000;
            if (secondsPassed >= requiredDelay) {
              eligibleEmails.push(email);
            } else {
              const remainingDelay = Math.ceil(requiredDelay - secondsPassed);
              if (minRetryDelayNeeded === null || remainingDelay < minRetryDelayNeeded) {
                minRetryDelayNeeded = remainingDelay;
              }
            }
          }
        }

        if (minRetryDelayNeeded !== null && minRetryDelayNeeded > 0) {
          this.scheduleRetry(minRetryDelayNeeded);
        }

        if (eligibleEmails.length === 0) {
          return;
        }

        // Atomically acquire cluster-wide batch slots (max 5 dispatches / 12s) only when emails exist
        const requestedSlots = Math.min(this.batchSize, eligibleEmails.length);
        const { grantedSlots, retryAfterMs } = await this.acquireClusterBatchSlots(requestedSlots);
        if (grantedSlots === 0) {
          this.scheduleBatchContinuation(retryAfterMs);
          return;
        }

        const validEmails = eligibleEmails.slice(0, grantedSlots);
        if (eligibleEmails.length > validEmails.length) {
          this.scheduleBatchContinuation(Math.max(this.batchWindowMs, retryAfterMs));
        }

        processedAnyBatch = true;
        console.log(`[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Found ${validEmails.length} eligible emails to process.`);
        console.log(`[EMAIL] [Queue Started] [${new Date().toISOString()}] Processing batch of size ${validEmails.length}`);

        const isRetryableError = (error: any): boolean => {
          if (error?.isPermanent === true || error?.isShutdownAbort === true) {
            return false;
          }
          if (error?.status) {
            const transientStatuses = [429, 500, 502, 503, 504];
            return transientStatuses.includes(error.status);
          }
          const errorMessage = error?.message ? String(error.message).toLowerCase() : '';
          return (
            error?.name === 'AbortError' ||
            error?.code === 'ECONNRESET' ||
            error?.code === 'ETIMEDOUT' ||
            error?.code === 'EPIPE' ||
            error?.code === 'TIMEOUT' ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('aborted') ||
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('network') ||
            errorMessage.includes('connection')
          );
        };

        await Promise.all(
          validEmails.map(async (email) => {
            const delayIdx = Math.max(0, Math.min(this.retryDelays.length - 1, (email.retryCount || 1) - 1));
            const requiredDelaySec = email.status === EmailStatus.FAILED ? this.retryDelays[delayIdx] || 15 : 0;

            let claimResult: any;
            try {
              const claimQb = this.emailLogRepo
                .createQueryBuilder()
                .update(EmailLog)
                .set({
                  status: EmailStatus.PROCESSING,
                  updatedAt: () => 'clock_timestamp()',
                })
                .where('id = :id', { id: email.id });

              if (email.status === EmailStatus.FAILED) {
                claimQb.andWhere(
                  'status = :expectedStatus AND "updatedAt" <= clock_timestamp() - (:requiredDelaySec * interval \'1 second\')',
                  { expectedStatus: EmailStatus.FAILED, requiredDelaySec },
                );
              } else {
                claimQb.andWhere('status = :expectedStatus', { expectedStatus: EmailStatus.PENDING });
              }

              claimResult = await claimQb
                .returning('"retryCount", to_char("updatedAt", \'YYYY-MM-DD HH24:MI:SS.US\') AS "claimStamp"')
                .execute();
            } catch (claimError: any) {
              this.logger.warn(
                `[EMAIL_CLAIM_ERROR] Aborting send for Email ID ${email.id} due to atomic claim failure: ${claimError?.message || claimError}`,
              );
              return;
            }

            const claimedRows = Array.isArray(claimResult?.raw) ? claimResult.raw : [];
            const affected = typeof claimResult?.affected === 'number' ? claimResult.affected : claimedRows.length;
            if (affected === 0) {
              this.logger.debug(`Email ID ${email.id} was already claimed or is no longer eligible.`);
              return;
            }

            const claimStamp: string | null = claimedRows[0]?.claimStamp ?? null;
            const currentRetryCount: number =
              typeof claimedRows[0]?.retryCount === 'number' ? claimedRows[0].retryCount : email.retryCount || 0;

            console.log(
              `[EMAIL] [Queue Picked] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | Status: PROCESSING`,
            );

            const controller = new AbortController();
            this.activeAbortControllers.add(controller);

            const sendStart = Date.now();
            let attempt = 0;
            const maxAttempts = 3;
            let delay = 1000;
            let sentSuccess = false;
            let sendResult: any = null;
            let lastError: any = null;

            try {
              while (attempt < maxAttempts && !sentSuccess) {
                if (this.isShuttingDown || controller.signal.aborted) {
                  lastError = lastError || new Error('Email send aborted during shutdown');
                  break;
                }

                attempt++;
                const smtpStart = Date.now();
                try {
                  sendResult = await this.emailService.sendEmailViaApi(email, controller.signal);

                  const smtpDuration = Date.now() - smtpStart;
                  const totalDuration = Date.now() - sendStart;
                  this.performanceService.recordEmailSend(totalDuration, smtpDuration, true, attempt - 1);
                  sentSuccess = true;

                  console.log(
                    `[EMAIL_SEND] ` +
                    `Workflow Stage: ${email.subject} | ` +
                    `Report ID: ${email.relatedReportId || 'N/A'} | ` +
                    `Recipient: ${email.recipient} | ` +
                    `Event Name: ${email.event} | ` +
                    `Queue Job ID: ${email.id} | ` +
                    `Correlation ID: ${getCorrelationId()} | ` +
                    `Timestamp: ${new Date().toISOString()} | ` +
                    `Listener Name: EmailQueueService`,
                  );
                  console.log(
                    `[EMAIL] [Success] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | Status: SENT`,
                  );
                } catch (error: any) {
                  lastError = error;
                  const totalDuration = Date.now() - sendStart;
                  this.performanceService.recordEmailSend(totalDuration, 0, false, attempt);

                  console.warn(
                    `[EMAIL] [Attempt Failed] [${new Date().toISOString()}] ` +
                    `Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                    `Attempt: ${attempt}/${maxAttempts} | Error: ${error?.message || error}`,
                  );

                  if (!isRetryableError(error) || this.isShuttingDown || controller.signal.aborted) {
                    break;
                  }

                  if (attempt < maxAttempts) {
                    await this.abortableDelay(delay, controller.signal);
                    delay *= 2;
                  }
                }
              }
            } finally {
              this.activeAbortControllers.delete(controller);
            }

            let targetStatus: EmailStatus;
            let nextRetryCount = currentRetryCount;
            let failureReasonValue: string | null = null;
            let shouldScheduleRetryDelaySec: number | null = null;

            if (sentSuccess) {
              targetStatus = EmailStatus.SENT;
              email.status = EmailStatus.SENT;
              email.sentTime = new Date();
              email.failureReason = null as unknown as string;
              if (sendResult?.messageId) {
                email.providerMessageId = sendResult.messageId;
              }
            } else {
              const isShutdownAbort = Boolean(lastError?.isShutdownAbort || lastError?.name === 'AbortError');
              const deliveryUncertain = Boolean(lastError?.deliveryUncertain);
              const retryable = !isShutdownAbort && isRetryableError(lastError);
              const statusCode = isShutdownAbort ? 'ABORTED' : lastError?.status || 'N/A';
              const errorMsg = lastError?.message || 'Unknown email delivery failure';

              let providerLabel = 'Gmail SMTP';
              if (errorMsg.includes('Google Apps Script') && errorMsg.includes('SMTP')) {
                providerLabel = 'Dual Provider (GAS & SMTP)';
              } else if (errorMsg.includes('Google Apps Script')) {
                providerLabel = 'Google Apps Script';
              }

              if (isShutdownAbort) {
                nextRetryCount = currentRetryCount;
                failureReasonValue = JSON.stringify({
                  providerName: providerLabel,
                  error: deliveryUncertain
                    ? 'Shutdown aborted in-flight provider request; delivery status uncertain (verify before resending to avoid duplicates)'
                    : errorMsg,
                  responseCode: statusCode,
                  responseBody: errorMsg,
                  shutdownInterrupted: true,
                  deliveryUncertain,
                  stackTrace: lastError?.stack || 'N/A',
                  deliveryTime: null,
                });

                email.retryCount = nextRetryCount;
                email.failureReason = failureReasonValue;

                if (deliveryUncertain) {
                  targetStatus = EmailStatus.CANCELLED;
                  email.status = EmailStatus.CANCELLED;
                  this.logger.warn(
                    `[EMAIL_SHUTDOWN_UNCERTAIN] Email ID ${email.id} aborted in-flight during shutdown; marked CANCELLED (deliveryUncertain=true) to prevent duplicate resend.`,
                  );
                } else {
                  targetStatus = EmailStatus.FAILED;
                  email.status = EmailStatus.FAILED;
                  shouldScheduleRetryDelaySec = this.retryDelays[Math.max(0, nextRetryCount - 1)] || this.retryDelays[0];
                  this.logger.warn(
                    `[EMAIL_SHUTDOWN_RETRYABLE] Email ID ${email.id} interrupted before provider dispatch; marked FAILED for safe retry.`,
                  );
                }
              } else {
                nextRetryCount = currentRetryCount + 1;
                failureReasonValue = JSON.stringify({
                  providerName: providerLabel,
                  error: errorMsg,
                  responseCode: statusCode,
                  responseBody: errorMsg,
                  stackTrace: lastError?.stack || 'N/A',
                  deliveryTime: null,
                });

                email.retryCount = nextRetryCount;
                email.failureReason = failureReasonValue;

                if (!retryable || nextRetryCount > this.maxRetries) {
                  targetStatus = EmailStatus.CANCELLED;
                  email.status = EmailStatus.CANCELLED;
                  console.error(
                    `[EMAIL] [Failure] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                    `Action: CANCELLED | Reason: Non-retryable error or exceeded max retries (${nextRetryCount}/${this.maxRetries})`,
                  );
                } else {
                  targetStatus = EmailStatus.FAILED;
                  email.status = EmailStatus.FAILED;
                  shouldScheduleRetryDelaySec = this.retryDelays[nextRetryCount - 1] || 15;
                  console.log(
                    `[EMAIL] [Retry] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                    `Action: RETRY_SCHEDULED | Retry: ${nextRetryCount}/${this.maxRetries} (delay ${shouldScheduleRetryDelaySec}s)`,
                  );
                }
              }
            }

            const updatePayload: Record<string, any> = {
              status: targetStatus,
              retryCount: nextRetryCount,
              failureReason: failureReasonValue,
              updatedAt: () => 'clock_timestamp()',
            };
            if (sentSuccess) {
              updatePayload.sentTime = () => 'clock_timestamp()';
              if (sendResult?.messageId) {
                updatePayload.providerMessageId = sendResult.messageId;
              }
            }

            const finalQb = this.emailLogRepo
              .createQueryBuilder()
              .update(EmailLog)
              .set(updatePayload)
              .where('id = :id AND status = :processingStatus', {
                id: email.id,
                processingStatus: EmailStatus.PROCESSING,
              });

            if (claimStamp) {
              finalQb.andWhere('to_char("updatedAt", \'YYYY-MM-DD HH24:MI:SS.US\') = :claimStamp', { claimStamp });
            }

            const finalResult = await finalQb.execute();
            if (typeof finalResult?.affected === 'number' && finalResult.affected === 0) {
              this.logger.warn(
                `[EMAIL_STATE_CONFLICT] Skipped stale state update for Email ID ${email.id}; row state changed outside this worker.`,
              );
              return;
            }

            if (shouldScheduleRetryDelaySec !== null && !this.isShuttingDown) {
              this.scheduleRetry(shouldScheduleRetryDelaySec);
            }

            console.log(`[EMAIL] [Database Updated] [${new Date().toISOString()}] Email ID: ${email.id} | Status: ${targetStatus}`);
          }),
        );

        const duration = Date.now() - startTime;
        this.monitoringService.recordQueueProcessingTime(duration);

        const slowEmailQueueThreshold = Number(process.env.SLOW_EMAIL_THRESHOLD_MS) || 3000;
        if (duration > slowEmailQueueThreshold) {
          this.logger.warn(`[SLOW_OPERATION] Slow email queue processing detected (${duration}ms)`);
        }
      } catch (cronError: any) {
        this.logger.error(`[EMAIL_QUEUE_CRASH] Critical unhandled error in email queue runner: ${cronError?.message}`, cronError?.stack);
      } finally {
        if (processedAnyBatch) {
          this.lastBatchCompletedAt = Date.now();
        }
        this.isProcessing = false;
        if (this.pendingRescan && !this.isShuttingDown) {
          this.pendingRescan = false;
          this.scheduleQueueWakeup(0);
        }
      }
    });
  }
}
