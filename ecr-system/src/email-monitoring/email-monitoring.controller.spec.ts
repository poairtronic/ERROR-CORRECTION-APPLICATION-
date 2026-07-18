import { EmailMonitoringController } from './email-monitoring.controller';
import { EmailMonitoringService } from './email-monitoring.service';

describe('EmailMonitoringController', () => {
  let controller: EmailMonitoringController;
  let service: Partial<EmailMonitoringService>;

  beforeEach(() => {
    service = {
      getSummary: jest.fn().mockResolvedValue({
        total: 100, queued: 5, processing: 2, sent: 90, failed: 3, cancelled: 0,
        todayCount: 10, weekCount: 50, monthCount: 100,
        successRate: 90, failureRate: 3, avgDeliveryTimeSeconds: 5,
      }),
      list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 }),
      exportToCsv: jest.fn().mockResolvedValue('Email ID,Report Number\ne1,AGIPL-001'),
      findOne: jest.fn().mockResolvedValue({ email: { id: 'e1' }, recipientRole: 'ADMIN' }),
      resend: jest.fn().mockResolvedValue({ id: 'e1', status: 'PENDING' }),
      retry: jest.fn().mockResolvedValue({ id: 'e1', status: 'PENDING' }),
      cancel: jest.fn().mockResolvedValue({ id: 'e1', status: 'CANCELLED' }),
    };
    controller = new EmailMonitoringController(service as EmailMonitoringService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should return email summary metrics', async () => {
      const result = await controller.getSummary();
      expect(service.getSummary).toHaveBeenCalled();
      expect(result.total).toBe(100);
      expect(result.successRate).toBe(90);
    });
  });

  describe('list', () => {
    it('should return paginated email list', async () => {
      const query = { page: 1, limit: 10, status: 'SENT' };
      const result = await controller.list(query);
      expect(service.list).toHaveBeenCalledWith(query);
      expect(result).toEqual({ items: [], total: 0, page: 1, limit: 10 });
    });
  });

  describe('export', () => {
    it('should set CSV headers and return CSV content', async () => {
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      } as any;
      const query = {};

      await controller.export(query, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="email-logs-export.csv"');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Email ID'));
    });
  });

  describe('findOne', () => {
    it('should return a single email detail', async () => {
      const result = await controller.findOne('e1');
      expect(service.findOne).toHaveBeenCalledWith('e1');
      expect(result.email.id).toBe('e1');
    });
  });

  describe('resend', () => {
    it('should resend an email', async () => {
      const req = { user: { id: 'admin-1', email: 'admin@test.com' } };
      const result = await controller.resend('e1', 'Resend test', req);
      expect(service.resend).toHaveBeenCalledWith('e1', req.user, 'Resend test');
    });

    it('should use default reason if not provided', async () => {
      const req = { user: { id: 'admin-1' } };
      const result = await controller.resend('e1', undefined as any, req);
      expect(service.resend).toHaveBeenCalledWith('e1', req.user, 'Manual Admin Resend');
    });
  });

  describe('retry', () => {
    it('should retry an email', async () => {
      const req = { user: { id: 'admin-1' } };
      await controller.retry('e1', 'retry test', req);
      expect(service.retry).toHaveBeenCalledWith('e1', req.user, 'retry test');
    });
  });

  describe('cancel', () => {
    it('should cancel an email', async () => {
      const req = { user: { id: 'admin-1' } };
      await controller.cancel('e1', 'cancel test', req);
      expect(service.cancel).toHaveBeenCalledWith('e1', req.user, 'cancel test');
    });
  });
});
