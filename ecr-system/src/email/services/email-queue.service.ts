import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { runWithTraceContext } from '../../common/trace-context';
import { MonitoringService } from '../../monitoring/monitoring.service';
import * as crypto from 'crypto';

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly maxRetries: number;

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private emailService: EmailService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
    private monitoringService: MonitoringService,
  ) {
    this.maxRetries = 3; // Official SDK requirement: 3 retries
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processEmailQueue() {
    const traceCtx = {
      correlationId: `cron-email-queue-${crypto.randomUUID()}`,
      requestId: crypto.randomUUID(),
    };

    return runWithTraceContext(traceCtx, async () => {
      const startTime = Date.now();
      try {
        // [STEP 5] Queue Processing
        console.log('[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Polling email queue...');
        
        let emailsToProcess: EmailLog[];
        try {
          emailsToProcess = await this.emailLogRepo.find({
            where: [
              { status: EmailStatus.PENDING },
              { status: EmailStatus.FAILED },
            ],
            order: { createdAt: 'ASC' },
            take: 100,
          });
        } catch (error: any) {
          console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to query pending emails from database.\nReason: ${error.message}\nFile: email-queue.service.ts\nMethod: processEmailQueue\nStack: ${error.stack}`);
          throw error;
        }

        console.log("Emails fetched from DB:", emailsToProcess.length);

        // Filter by backoff delays (Retry Engine)
        const eligibleEmails: EmailLog[] = [];
        const retryDelays = [2, 5, 15]; // delays in seconds for retry count 1, 2, 3

        for (const email of emailsToProcess) {
          if (email.status === EmailStatus.PENDING) {
            eligibleEmails.push(email);
          } else if (email.status === EmailStatus.FAILED) {
            const secondsPassed = (Date.now() - email.updatedAt.getTime()) / 1000;
            const requiredDelay = retryDelays[email.retryCount - 1] || 15;
            if (secondsPassed >= requiredDelay) {
              eligibleEmails.push(email);
            }
          }
        }

        // Limit to at most 5 emails per minute (Rate Limit)
        const validEmails = eligibleEmails.slice(0, 5);
        if (validEmails.length === 0) return;

        console.log(`[EMAIL_DIAGNOSTICS] [STEP 5] Queue Processing: Found ${validEmails.length} eligible emails to process.`);
        console.log(`[EMAIL] [Queue Started] [${new Date().toISOString()}] Processing batch of size ${validEmails.length}`);

        const isRetryableError = (error: any): boolean => {
          if (error.status) {
            const transientStatuses = [429, 500, 502, 503, 504];
            return transientStatuses.includes(error.status);
          }
          const errorMessage = error.message ? error.message.toLowerCase() : '';
          return (
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'EPIPE' ||
            error.code === 'TIMEOUT' ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('fetch failed') ||
            errorMessage.includes('network')
          );
        };

        await Promise.all(
          validEmails.map(async (email) => {
            email.status = EmailStatus.PROCESSING;
            await this.emailLogRepo.save(email);
            this.eventEmitter.emit('email.logs.updated');
            console.log(`[EMAIL] [Queue Picked] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | Status: PROCESSING`);

            let attempt = 0;
            const maxAttempts = 3;
            let delay = 1000; // start with 1 second delay
            let sentSuccess = false;
            let lastError: any = null;

            while (attempt < maxAttempts && !sentSuccess) {
              attempt++;
              try {
                // Send via Gmail Provider
                await this.emailService.sendEmailViaApi(email);
                
                email.status = EmailStatus.SENT;
                email.sentTime = new Date();
                email.failureReason = null as any;
                sentSuccess = true;
                
                console.log(`[EMAIL] [Success] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | Status: SENT`);
              } catch (error: any) {
                lastError = error;
                console.warn(
                  `[EMAIL] [Attempt Failed] [${new Date().toISOString()}] ` +
                  `Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                  `Attempt: ${attempt}/${maxAttempts} | Error: ${error.message}`
                );

                if (attempt < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, delay));
                  delay *= 2; // exponential backoff
                }
              }
            }

            if (!sentSuccess) {
              const retryable = isRetryableError(lastError);
              email.retryCount += 1;
              
              const statusCode = lastError.status || 'N/A';
              email.failureReason = JSON.stringify({
                providerName: 'Gmail SMTP',
                error: lastError.message,
                responseCode: statusCode,
                responseBody: lastError.message,
                stackTrace: lastError.stack || 'N/A',
                deliveryTime: null,
              });

              if (!retryable || email.retryCount >= this.maxRetries) {
                email.status = EmailStatus.CANCELLED;
                console.error(
                  `[EMAIL] [Failure] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                  `Action: CANCELLED | Reason: Non-retryable error or exceeded max attempts`
                );
              } else {
                email.status = EmailStatus.FAILED;
                console.log(
                  `[EMAIL] [Retry] [${new Date().toISOString()}] Email ID: ${email.id} | Recipient: ${email.recipient} | ` +
                  `Action: RETRY_SCHEDULED | Attempt: ${email.retryCount}/${this.maxRetries}`
                );
              }
            }

            // [STEP 12] Database Updated
            await this.emailLogRepo.save(email);
            console.log(`[EMAIL] [Database Updated] [${new Date().toISOString()}] Email ID: ${email.id} | Status: ${email.status}`);
            this.eventEmitter.emit('email.logs.updated');
          })
        );

        const duration = Date.now() - startTime;
        this.monitoringService.recordQueueProcessingTime(duration);

        const slowEmailQueueThreshold = Number(process.env.SLOW_EMAIL_THRESHOLD_MS) || 3000;
        if (duration > slowEmailQueueThreshold) {
          this.logger.warn(`[SLOW_OPERATION] Slow email queue processing detected (${duration}ms)`);
        }
      } catch (cronError: any) {
        this.logger.error(`[EMAIL_QUEUE_CRASH] Critical unhandled error in email queue runner: ${cronError.message}`, cronError.stack);
      }
    });
  }
}
