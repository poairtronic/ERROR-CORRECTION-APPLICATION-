import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailService } from './email.service';
import { EmailLog } from '../entities/email-log.entity';
import { EmailTemplateService } from './email-template.service';
import { GmailSmtpService } from './gmail-smtp.service';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { NotificationEvent } from '../enums/notification-event.enum';
import { EmailStatus } from '../enums/email-status.enum';

describe('EmailService', () => {
  let service: EmailService;
  
  const mockEmailLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((k) => k === 'EMAIL_FROM' ? 'no-reply@test.com' : 'Test Sender'),
  };

  const mockTemplateService = {
    renderHtml: jest.fn().mockReturnValue('<html>body</html>'),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockSmtpService = {
    hasScriptUrl: jest.fn(),
    sendMailViaGas: jest.fn(),
    getTransporter: jest.fn(),
  };

  const mockMonitoringService = {
    recordEmailLatency: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: getRepositoryToken(EmailLog), useValue: mockEmailLogRepo },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailTemplateService, useValue: mockTemplateService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: GmailSmtpService, useValue: mockSmtpService },
        { provide: MonitoringService, useValue: mockMonitoringService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should queue email correctly', async () => {
    mockEmailLogRepo.create.mockImplementation((dto) => dto);
    mockEmailLogRepo.save.mockResolvedValue({ id: '1' });
    
    await service.queueEmail({
      recipient: 'test@example.com',
      subject: 'Test subject',
      event: NotificationEvent.REPORT_CREATED,
      templateData: {},
    });

    expect(mockTemplateService.renderHtml).toHaveBeenCalledWith('pending-review', {}, '[ECR] Test subject');
    expect(mockEmailLogRepo.save).toHaveBeenCalled();
    expect(mockEventEmitter.emit).toHaveBeenCalledWith('email.logs.updated');
  });

  it('sendEmailViaApi should use Gas if script url exists', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(true);
    mockSmtpService.sendMailViaGas.mockResolvedValue({ messageId: 'm1', responseCode: 200, responseBody: 'ok' });
    
    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: 'body', isHtml: true } as any;
    const res = await service.sendEmailViaApi(emailLog);
    
    expect(res.messageId).toBe('m1');
    expect(mockSmtpService.sendMailViaGas).toHaveBeenCalled();
    expect(mockMonitoringService.recordEmailLatency).toHaveBeenCalled();
  });

  it('sendEmailViaApi should throw if recipient invalid', async () => {
    const emailLog = { id: '1', recipient: 'invalid', subject: 'subj', content: 'body' } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('Recipient email address is invalid: [invalid]');
  });

  it('resend should update status to PENDING', async () => {
    const email = { id: '1', status: EmailStatus.FAILED, retryCount: 3 };
    mockEmailLogRepo.findOne.mockResolvedValue(email);
    mockEmailLogRepo.save.mockImplementation(async (e) => e);
    
    await service.resend('1');
    
    expect(email.status).toBe(EmailStatus.PENDING);
    expect(email.retryCount).toBe(0);
    expect(mockEmailLogRepo.save).toHaveBeenCalled();
  });
});
