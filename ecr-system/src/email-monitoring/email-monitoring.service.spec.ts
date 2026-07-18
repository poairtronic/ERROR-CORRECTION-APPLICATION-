import { EmailMonitoringService } from './email-monitoring.service';
import { NotFoundException } from '@nestjs/common';

describe('EmailMonitoringService', () => {
  let service: EmailMonitoringService;
  let emailLogRepo: any;
  let auditLogRepo: any;
  let userRepo: any;
  let reportRepo: any;
  let notificationRepo: any;

  beforeEach(() => {
    emailLogRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { status: 'SENT', count: '50' },
          { status: 'FAILED', count: '5' },
          { status: 'PENDING', count: '3' },
        ]),
        getRawOne: jest.fn().mockResolvedValue({ todayCount: '10', weekCount: '30', monthCount: '50', avg: '5' }),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      }),
    };
    auditLogRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      create: jest.fn().mockImplementation((data: any) => data),
    };
    userRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    reportRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    notificationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new EmailMonitoringService(
      emailLogRepo,
      auditLogRepo,
      userRepo,
      reportRepo,
      notificationRepo,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return aggregated email metrics', async () => {
      const result = await service.getSummary();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('sent');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('successRate');
      expect(result).toHaveProperty('avgDeliveryTimeSeconds');
    });
  });

  describe('findOne', () => {
    it('should return email detail with user and report data', async () => {
      const mockEmail = {
        id: 'e1',
        recipient: 'a@b.com',
        relatedReportId: 'rpt-1',
        notificationId: 'n1',
        failureReason: null,
      };
      emailLogRepo.findOne.mockResolvedValue(mockEmail);

      const result = await service.findOne('e1');
      expect(result.email).toEqual(mockEmail);
      expect(result).toHaveProperty('recipientRole');
      expect(result).toHaveProperty('auditLogs');
    });

    it('should throw NotFoundException if email log not found', async () => {
      emailLogRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('e999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resend', () => {
    it('should reset email status and create audit log', async () => {
      const mockEmail = { id: 'e1', status: 'FAILED', retryCount: 2, failureReason: 'error' };
      emailLogRepo.findOne.mockResolvedValue(mockEmail);

      const result = await service.resend('e1', { id: 'admin-1', username: 'admin' }, 'Manual resend');
      expect(result.status).toBe('PENDING');
      expect(result.retryCount).toBe(0);
      expect(auditLogRepo.save).toHaveBeenCalled();
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RESEND', reason: 'Manual resend' }),
      );
    });

    it('should throw NotFoundException if email not found', async () => {
      emailLogRepo.findOne.mockResolvedValue(null);
      await expect(service.resend('e999', {}, 'test')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retry', () => {
    it('should reset email for retry and create audit log', async () => {
      const mockEmail = { id: 'e1', status: 'FAILED', retryCount: 1, failureReason: 'timeout' };
      emailLogRepo.findOne.mockResolvedValue(mockEmail);

      const result = await service.retry('e1', { id: 'admin-1', email: 'admin@test.com' }, 'Retry test');
      expect(result.status).toBe('PENDING');
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'RETRY' }),
      );
    });
  });

  describe('cancel', () => {
    it('should mark email as cancelled and create audit log', async () => {
      const mockEmail = { id: 'e1', status: 'PENDING' };
      emailLogRepo.findOne.mockResolvedValue(mockEmail);

      const result = await service.cancel('e1', { id: 'admin-1', email: 'admin@test.com' }, 'Cancel test');
      expect(result.status).toBe('CANCELLED');
      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CANCEL' }),
      );
    });
  });

  describe('exportToCsv', () => {
    it('should return CSV string with headers', async () => {
      // Mock list to return items
      jest.spyOn(service, 'list').mockResolvedValue({
        items: [{
          id: 'e1',
          reportNumber: 'AGIPL-001',
          recipient: 'a@b.com',
          recipientRole: 'ADMIN',
          subject: 'Test',
          event: 'REPORT_CREATED' as any,
          status: 'SENT' as any,
          providerName: 'Gmail SMTP',
          retryCount: 0,
          createdAt: new Date(),
          sentTime: new Date(),
          deliveryTimeSeconds: 5,
          providerMessageId: 'msg-1',
          failureReason: null as any,
        }] as any[],
        total: 1,
        page: 1,
        limit: 1000,
      });

      const csv = await service.exportToCsv({});
      expect(csv).toContain('Email ID');
      expect(csv).toContain('Report Number');
      expect(csv).toContain('e1');
    });
  });
});
