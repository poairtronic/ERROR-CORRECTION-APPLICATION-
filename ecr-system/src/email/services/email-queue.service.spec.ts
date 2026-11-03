import { EmailQueueService } from './email-queue.service';

// Mock trace-context module
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

  beforeEach(() => {
    emailLogRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    emailService = {
      sendEmailViaApi: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockReturnValue('3'),
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

    service = new EmailQueueService(
      emailLogRepo,
      emailService,
      configService,
      eventEmitter,
      monitoringService,
      performanceService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processEmailQueue', () => {
    it('should skip processing when shutting down', async () => {
      // Trigger shutdown
      (service as any).isShuttingDown = true;
      await service.processEmailQueue();
      expect(emailLogRepo.find).not.toHaveBeenCalled();
    });

    it('should process pending emails successfully', async () => {
      const mockEmail = {
        id: 'e1',
        status: 'PENDING',
        recipient: 'a@b.com',
        retryCount: 0,
        updatedAt: new Date(),
      };
      emailLogRepo.find.mockResolvedValue([mockEmail]);

      await service.processEmailQueue();

      expect(emailService.sendEmailViaApi).toHaveBeenCalledWith(mockEmail);
      expect(emailLogRepo.save).toHaveBeenCalled();
      expect(monitoringService.recordQueueProcessingTime).toHaveBeenCalled();
    });

    it('should handle empty queue gracefully', async () => {
      emailLogRepo.find.mockResolvedValue([]);
      await service.processEmailQueue();
      expect(emailService.sendEmailViaApi).not.toHaveBeenCalled();
    });

    it('should handle send failures and mark as FAILED', async () => {
      const mockEmail = {
        id: 'e1',
        status: 'PENDING',
        recipient: 'a@b.com',
        retryCount: 0,
        updatedAt: new Date(),
      };
      emailLogRepo.find.mockResolvedValue([mockEmail]);
      emailService.sendEmailViaApi.mockRejectedValue(new Error('SMTP connection failed'));

      await service.processEmailQueue();

      // Should still save (with failed/cancelled status)
      expect(emailLogRepo.save).toHaveBeenCalled();
    });

    it('should limit batch to 5 emails per cycle', async () => {
      const emails = Array.from({ length: 10 }, (_, i) => ({
        id: `e${i}`,
        status: 'PENDING',
        recipient: `user${i}@test.com`,
        retryCount: 0,
        updatedAt: new Date(),
      }));
      emailLogRepo.find.mockResolvedValue(emails);

      await service.processEmailQueue();

      // Should process at most 5
      expect(emailService.sendEmailViaApi).toHaveBeenCalledTimes(5);
    });
  });

  describe('beforeApplicationShutdown', () => {
    it('should set isShuttingDown flag', async () => {
      (service as any).isProcessing = false;
      await service.beforeApplicationShutdown();
      expect((service as any).isShuttingDown).toBe(true);
    });
  });

  describe('recoverGasQuotaExceededEmails', () => {
    it('should reset failed emails to PENDING and emit event', async () => {
      const mockFailed = [
        { id: '1', status: 'CANCELLED', retryCount: 3, failureReason: 'Google Apps Script error: Exception: Service invoked too many times' },
      ];
      emailLogRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockFailed),
      });

      const count = await service.recoverGasQuotaExceededEmails();

      expect(count).toBe(1);
      expect(mockFailed[0].status).toBe('PENDING');
      expect(mockFailed[0].retryCount).toBe(0);
      expect(mockFailed[0].failureReason).toBeNull();
      expect(emailLogRepo.save).toHaveBeenCalledWith(mockFailed);
      expect(eventEmitter.emit).toHaveBeenCalledWith('email.logs.updated');
    });
  });
});
