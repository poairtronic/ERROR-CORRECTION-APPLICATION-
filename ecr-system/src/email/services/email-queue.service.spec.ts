import { CronExpression } from '@nestjs/schedule';
import { EmailQueueService } from './email-queue.service';
import { EmailStatus } from '../enums/email-status.enum';

jest.mock('../../common/trace-context', () => ({
  runWithTraceContext: jest.fn((_ctx, fn) => fn()),
  getCorrelationId: jest.fn(() => 'test-correlation-id'),
}));

describe('EmailQueueService', () => {
  let service: EmailQueueService;
  let emailLogRepo: any;
  let emailService: any;
  let configService: any;
  let eventEmitter: any;
  let monitoringService: any;
  let performanceService: any;
  let schedulerRegistry: any;
  let createQueryBuilderQueue: any[];

  const createMockQb = (executeResult: any = { affected: 1, raw: [] }, countResult = 0) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(countResult),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(executeResult),
    };
    return qb;
  };

  beforeEach(() => {
    jest.useRealTimers();
    createQueryBuilderQueue = [];
    const defaultQb = createMockQb({ affected: 1, raw: [] }, 0);

    emailLogRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        if (createQueryBuilderQueue.length > 0) {
          return createQueryBuilderQueue.shift();
        }
        return defaultQb;
      }),
      manager: {
        query: jest.fn().mockResolvedValue([{ grantedSlots: 5, retryAfterMs: 12000 }]),
      },
    };
    emailService = {
      sendEmailViaApi: jest.fn().mockResolvedValue({ messageId: 'provider-msg-1', responseCode: 200, responseBody: 'ok' }),
    };
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    monitoringService = {
      recordQueueProcessingTime: jest.fn(),
    };
    performanceService = {
      recordEmailSend: jest.fn(),
    };
    schedulerRegistry = {
      doesExist: jest.fn().mockReturnValue(false),
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
    };

    service = new EmailQueueService(
      emailLogRepo,
      emailService,
      configService,
      eventEmitter,
      monitoringService,
      performanceService,
      schedulerRegistry,
    );
  });

  afterEach(() => {
    service.clearScheduledTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEmailQueue', () => {
    it('should skip processing when shutting down', async () => {
      (service as any).isShuttingDown = true;
      await service.processEmailQueue();
      expect(emailLogRepo.find).not.toHaveBeenCalled();
    });

    it('should process pending emails successfully via atomic claim and conditional update (never unconditional save)', async () => {
      const claimQb = createMockQb({ affected: 1, raw: [{ retryCount: 0, claimStamp: '2026-11-26 10:00:00.123456' }] });
      const finalQb = createMockQb({ affected: 1 });
      createQueryBuilderQueue.push(claimQb, finalQb);

      const mockEmail = {
        id: 'e1',
        status: EmailStatus.PENDING,
        recipient: 'a@b.com',
        subject: 'Subj',
        event: 'REPORT_CREATED',
        retryCount: 0,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date(),
      };
      emailLogRepo.find.mockResolvedValue([mockEmail]);

      await service.processEmailQueue();

      expect(emailLogRepo.find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'ASC' } }));
      expect(emailService.sendEmailViaApi).toHaveBeenCalledWith(mockEmail, expect.any(AbortSignal));
      expect(claimQb.returning).toHaveBeenCalled();
      expect(finalQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EmailStatus.SENT,
          providerMessageId: 'provider-msg-1',
          failureReason: null,
        }),
      );
      expect(finalQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('claimStamp'),
        expect.objectContaining({ claimStamp: '2026-11-26 10:00:00.123456' }),
      );
      expect(emailLogRepo.save).not.toHaveBeenCalled();
      expect(monitoringService.recordQueueProcessingTime).toHaveBeenCalled();
    });

    it('should return early on empty queue with zero cluster quota queries or timers', async () => {
      emailLogRepo.find.mockResolvedValue([]);
      const scheduleSpy = jest.spyOn(service, 'scheduleRetry');

      await service.processEmailQueue();

      expect(emailService.sendEmailViaApi).not.toHaveBeenCalled();
      expect(emailLogRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    it('should NOT fallback to unconditional save() when atomic claim throws a DB error (D-03)', async () => {
      const brokenClaimQb = createMockQb();
      brokenClaimQb.execute.mockRejectedValueOnce(new Error('invalid input value for enum email_logs_status_enum: PROCESSING'));
      createQueryBuilderQueue.push(brokenClaimQb);

      emailLogRepo.find.mockResolvedValue([
        { id: 'e1', status: EmailStatus.PENDING, recipient: 'a@b.com', retryCount: 0, updatedAt: new Date() },
      ]);

      await service.processEmailQueue();

      expect(emailLogRepo.save).not.toHaveBeenCalled();
      expect(emailService.sendEmailViaApi).not.toHaveBeenCalled();
    });

    it('should NOT schedule retry or overwrite state when conditional final UPDATE affects 0 rows (D-04)', async () => {
      // Rate limiting uses manager.query; claim + conflict-final QBs only.
      const claimQb = createMockQb({ affected: 1, raw: [{ retryCount: 0, claimStamp: 'stamp-1' }] });
      const conflictFinalQb = createMockQb({ affected: 0 });
      createQueryBuilderQueue.push(claimQb, conflictFinalQb);

      const mockEmail = {
        id: 'e1',
        status: EmailStatus.PENDING,
        recipient: 'a@b.com',
        retryCount: 0,
        updatedAt: new Date(),
      };
      emailLogRepo.find.mockResolvedValue([mockEmail]);
      const transientErr = Object.assign(new Error('Network timeout'), { code: 'ETIMEDOUT' });
      emailService.sendEmailViaApi.mockRejectedValue(transientErr);
      jest.spyOn(service as any, 'abortableDelay').mockResolvedValue(undefined);
      const retrySpy = jest.spyOn(service, 'scheduleRetry').mockImplementation(() => {});

      await service.processEmailQueue();

      expect(emailLogRepo.save).not.toHaveBeenCalled();
      expect(retrySpy).not.toHaveBeenCalled();
    });

    it.each([
      { currentRetryCount: 0, expectedNextRetry: 1, expectedDelay: 2, expectedStatus: EmailStatus.FAILED },
      { currentRetryCount: 1, expectedNextRetry: 2, expectedDelay: 5, expectedStatus: EmailStatus.FAILED },
      { currentRetryCount: 2, expectedNextRetry: 3, expectedDelay: 15, expectedStatus: EmailStatus.FAILED },
      { currentRetryCount: 3, expectedNextRetry: 4, expectedDelay: null, expectedStatus: EmailStatus.CANCELLED },
    ])(
      'should use backoff schedule [2, 5, 15] across retries and cancel after >3 retries (retryCount $currentRetryCount -> $expectedStatus)',
      async ({ currentRetryCount, expectedNextRetry, expectedDelay, expectedStatus }) => {
        // Rate limiting uses manager.query (not createQueryBuilder), so only claim+final QBs needed.
        const claimQb = createMockQb({ affected: 1, raw: [{ retryCount: currentRetryCount, claimStamp: 's1' }] });
        const finalQb = createMockQb({ affected: 1 });
        createQueryBuilderQueue.push(claimQb, finalQb);

        const mockEmail = {
          id: 'e1',
          status: currentRetryCount === 0 ? EmailStatus.PENDING : EmailStatus.FAILED,
          recipient: 'a@b.com',
          retryCount: currentRetryCount,
          updatedAt: new Date(Date.now() - 60_000),
        };
        emailLogRepo.find.mockResolvedValue([mockEmail]);
        emailService.sendEmailViaApi.mockRejectedValue(Object.assign(new Error('Temporary 503'), { status: 503 }));
        jest.spyOn(service as any, 'abortableDelay').mockResolvedValue(undefined);
        const scheduleRetrySpy = jest.spyOn(service, 'scheduleRetry').mockImplementation(() => {});

        await service.processEmailQueue();

        expect(emailService.sendEmailViaApi).toHaveBeenCalledTimes(3);
        expect(finalQb.set).toHaveBeenCalledWith(
          expect.objectContaining({
            status: expectedStatus,
            retryCount: expectedNextRetry,
          }),
        );
        if (expectedDelay !== null) {
          expect(scheduleRetrySpy).toHaveBeenCalledWith(expectedDelay);
        } else {
          expect(scheduleRetrySpy).not.toHaveBeenCalled();
        }
      },
    );

    it('should short-circuit permanent errors immediately without inner retries or rescheduling (D-08)', async () => {
      // Rate limiting uses manager.query; only claim + final QBs needed for PENDING email.
      const claimQb = createMockQb({ affected: 1, raw: [{ retryCount: 0, claimStamp: 's1' }] });
      const finalQb = createMockQb({ affected: 1 });
      createQueryBuilderQueue.push(claimQb, finalQb);

      emailLogRepo.find.mockResolvedValue([
        { id: 'e-perm', status: EmailStatus.PENDING, recipient: 'bad@invalid', retryCount: 0, updatedAt: new Date() },
      ]);
      emailService.sendEmailViaApi.mockRejectedValue(
        Object.assign(new Error('550 Mailbox unavailable'), { status: 550, isPermanent: true }),
      );
      const scheduleRetrySpy = jest.spyOn(service, 'scheduleRetry').mockImplementation(() => {});

      await service.processEmailQueue();

      expect(emailService.sendEmailViaApi).toHaveBeenCalledTimes(1);
      expect(finalQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatus.CANCELLED }));
      expect(scheduleRetrySpy).not.toHaveBeenCalled();
    });

    it('should limit batch to 5 emails, coalesce single continuation timer, and respect cluster quota (D-10)', async () => {
      const emails = Array.from({ length: 8 }, (_, i) => ({
        id: `e${i}`,
        status: EmailStatus.PENDING,
        recipient: `user${i}@test.com`,
        retryCount: 0,
        updatedAt: new Date(),
      }));
      emailLogRepo.find.mockResolvedValue(emails);

      const continuationSpy = jest.spyOn(service, 'scheduleBatchContinuation').mockImplementation(() => {});
      await service.processEmailQueue();

      expect(emailService.sendEmailViaApi).toHaveBeenCalledTimes(5);
      expect(continuationSpy).toHaveBeenCalledWith(12000);

      // Simulate cluster rate-limiter returning 0 remaining slots (another instance filled the 12s window)
      jest.clearAllMocks();
      emailLogRepo.manager = {
        query: jest.fn().mockResolvedValueOnce([{ grantedSlots: 0, retryAfterMs: 9500 }]),
      };
      emailLogRepo.find.mockResolvedValue(emails);

      await service.processEmailQueue();
      expect(emailService.sendEmailViaApi).not.toHaveBeenCalled();
      expect(continuationSpy).toHaveBeenCalledWith(9500);
    });

    it('should defer when triggered during active run and rescan via pendingRescan instead of dropping event (D-06)', async () => {
      let releaseFirstSend!: () => void;
      const firstSendBlocked = new Promise<void>((resolve) => {
        releaseFirstSend = resolve;
      });

      const emails = [{ id: 'e1', status: EmailStatus.PENDING, recipient: 'a@b.com', retryCount: 0, updatedAt: new Date() }];
      emailLogRepo.find.mockResolvedValueOnce(emails).mockResolvedValueOnce([]);
      emailService.sendEmailViaApi.mockImplementationOnce(async () => {
        await firstSendBlocked;
        return { messageId: 'ok', responseCode: 200, responseBody: 'ok' };
      });

      const firstRun = service.processEmailQueue();
      // Yield a tick so firstRun reaches awaiting sendEmailViaApi
      await new Promise((r) => setTimeout(r, 15));

      // Trigger overlapping event while firstRun is still running
      await service.processEmailQueue();
      expect((service as any).pendingRescan).toBe(true);

      releaseFirstSend();
      await firstRun;

      // Flush scheduled wakeup(0) from pendingRescan
      await new Promise((r) => setTimeout(r, 30));
      expect(emailLogRepo.find).toHaveBeenCalledTimes(2);
    });

    it('should coalesce duplicate timers onto a single earliest nextTimer', () => {
      service.scheduleRetry(30);
      const firstTimer = (service as any).nextTimer;
      expect(firstTimer).toBeTruthy();

      // Scheduling a later wakeup must keep the earlier timer
      service.scheduleBatchContinuation(60000);
      expect((service as any).nextTimer).toBe(firstTimer);

      // Scheduling an earlier wakeup replaces it with the earlier timer
      service.scheduleRetry(5);
      expect((service as any).nextTimer).toBeTruthy();
      expect((service as any).nextTimer).not.toBe(firstTimer);
    });
  });

  describe('recoverStuckProcessingEmails', () => {
    it('should atomically cancel exhausted stuck jobs and reset remaining stuck jobs to FAILED using DB clock (D-01, D-11)', async () => {
      const cancelQb = createMockQb({ affected: 1 });
      const retryQb = createMockQb({ affected: 2 });
      createQueryBuilderQueue.push(cancelQb, retryQb);

      const count = await service.recoverStuckProcessingEmails(300_000);

      expect(count).toBe(3);
      expect(cancelQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatus.CANCELLED }));
      expect(cancelQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('clock_timestamp()'),
        expect.objectContaining({ thresholdMs: 300_000 }),
      );
      expect(retryQb.set).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatus.FAILED }));
      expect(emailLogRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('recoverGasQuotaExceededEmails', () => {
    it('should atomically reset only quota-matched rows and emit event only when rows recovered (D-12)', async () => {
      const quotaQb = createMockQb({ affected: 2 });
      createQueryBuilderQueue.push(quotaQb);

      const recovered = await service.recoverGasQuotaExceededEmails();
      expect(recovered).toBe(2);
      const whereClause = quotaQb.andWhere.mock.calls[0][0] as string;
      const whereParams = quotaQb.andWhere.mock.calls[0][1] as Record<string, string>;
      expect(whereClause).not.toContain('LIKE :msg_generic');
      expect(Object.values(whereParams)).not.toContain('%Google Apps Script error%');
      expect(eventEmitter.emit).toHaveBeenCalledWith('email.logs.updated');

      jest.clearAllMocks();
      createQueryBuilderQueue.push(createMockQb({ affected: 0 }));
      const zeroRecovered = await service.recoverGasQuotaExceededEmails();
      expect(zeroRecovered).toBe(0);
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle, cron, and shutdown', () => {
    it('onModuleInit should register configured EMAIL_QUEUE_CRON via SchedulerRegistry and run startup recovery asynchronously', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'EMAIL_QUEUE_CRON' ? '*/15 * * * *' : undefined,
      );
      const stuckSpy = jest.spyOn(service, 'recoverStuckProcessingEmails').mockResolvedValue(0);
      const gasSpy = jest.spyOn(service, 'recoverGasQuotaExceededEmails').mockResolvedValue(0);
      const processSpy = jest.spyOn(service, 'processEmailQueue').mockResolvedValue();

      await service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledWith(
        EmailQueueService.FALLBACK_CRON_NAME,
        expect.any(Object),
      );
      const addedJob = schedulerRegistry.addCronJob.mock.calls[0]?.[1];
      addedJob?.stop?.();
      // Startup DB calls must NOT block onModuleInit return; they run on next turn via setImmediate
      await new Promise((resolve) => setImmediate(resolve));

      expect(stuckSpy).toHaveBeenCalled();
      expect(gasSpy).toHaveBeenCalled();
      expect(processSpy).toHaveBeenCalled();
    });

    it('handleFallbackCron should recover stuck PROCESSING jobs before flushing the queue (D-02)', async () => {
      const order: string[] = [];
      jest.spyOn(service, 'recoverStuckProcessingEmails').mockImplementation(async () => {
        order.push('recover');
        return 1;
      });
      jest.spyOn(service, 'processEmailQueue').mockImplementation(async () => {
        order.push('process');
      });

      await service.handleFallbackCron();
      expect(order).toEqual(['recover', 'process']);
      expect(CronExpression.EVERY_30_MINUTES).toBe('0 */30 * * * *');
    });

    it('beforeApplicationShutdown should clear timers, delete cron job, and abort real in-flight send AbortSignal on drain timeout (D-09)', async () => {
      schedulerRegistry.doesExist.mockReturnValue(true);
      service.scheduleRetry(60);

      let capturedSignal: AbortSignal | undefined;
      let markInFlight!: () => void;
      const inFlightReady = new Promise<void>((r) => {
        markInFlight = r;
      });

      const claimQb = createMockQb({ affected: 1, raw: [{ retryCount: 0, claimStamp: 's-abort' }] });
      const finalQb = createMockQb({ affected: 1 });
      createQueryBuilderQueue.push(claimQb, finalQb);
      emailLogRepo.find.mockResolvedValue([
        { id: 'e-hang', status: EmailStatus.PENDING, recipient: 'a@b.com', retryCount: 0, updatedAt: new Date() },
      ]);

      emailService.sendEmailViaApi.mockImplementation(
        (_email: any, signal?: AbortSignal) =>
          new Promise((_resolve, reject) => {
            capturedSignal = signal;
            markInFlight();
            signal?.addEventListener('abort', () => {
              const err = new Error('Aborted during shutdown') as any;
              err.name = 'AbortError';
              reject(err);
            });
          }),
      );

      const activeRun = service.processEmailQueue();
      await inFlightReady;

      let fakeNow = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => {
        fakeNow += 1500;
        return fakeNow;
      });

      await service.beforeApplicationShutdown();
      await activeRun;

      expect((service as any).isShuttingDown).toBe(true);
      expect((service as any).nextTimer).toBeNull();
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(EmailQueueService.FALLBACK_CRON_NAME);
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(true);
      expect(finalQb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EmailStatus.FAILED,
          retryCount: 0,
        }),
      );
    });

    it('should mark pre-dispatch shutdown abort as FAILED (safely retryable) and in-flight abort as CANCELLED with deliveryUncertain=true', async () => {
      const claimQb1 = createMockQb({ affected: 1, raw: [{ retryCount: 0, claimStamp: 's-pre' }] });
      const finalQb1 = createMockQb({ affected: 1 });
      createQueryBuilderQueue.push(claimQb1, finalQb1);
      emailLogRepo.find.mockResolvedValueOnce([
        { id: 'e-pre', status: EmailStatus.PENDING, recipient: 'a@b.com', retryCount: 0, updatedAt: new Date() },
      ]);
      emailService.sendEmailViaApi.mockRejectedValueOnce(
        Object.assign(new Error('Aborted before dispatch'), {
          name: 'AbortError',
          isShutdownAbort: true,
          deliveryUncertain: false,
        }),
      );

      await service.processEmailQueue();
      expect(finalQb1.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EmailStatus.FAILED,
          retryCount: 0,
        }),
      );

      const claimQb2 = createMockQb({ affected: 1, raw: [{ retryCount: 1, claimStamp: 's-inflight' }] });
      const finalQb2 = createMockQb({ affected: 1 });
      createQueryBuilderQueue.push(claimQb2, finalQb2);
      emailLogRepo.find.mockResolvedValueOnce([
        { id: 'e-inflight', status: EmailStatus.PENDING, recipient: 'a@b.com', retryCount: 1, updatedAt: new Date() },
      ]);
      emailService.sendEmailViaApi.mockRejectedValueOnce(
        Object.assign(new Error('Aborted in-flight'), {
          name: 'AbortError',
          isShutdownAbort: true,
          deliveryUncertain: true,
        }),
      );

      await service.processEmailQueue();
      const setArg = finalQb2.set.mock.calls[0][0];
      expect(setArg.status).toBe(EmailStatus.CANCELLED);
      expect(setArg.retryCount).toBe(1);
      expect(JSON.parse(setArg.failureReason)).toMatchObject({
        shutdownInterrupted: true,
        deliveryUncertain: true,
      });
    });
  });
});
