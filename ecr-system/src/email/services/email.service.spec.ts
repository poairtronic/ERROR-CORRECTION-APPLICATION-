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

  it('sendEmailViaApi should throw if recipient is missing', async () => {
    const emailLog = { id: '1', recipient: '', subject: 'subj', content: 'body' } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('Recipient email is missing');
  });

  it('sendEmailViaApi should throw if subject is empty', async () => {
    const emailLog = { id: '1', recipient: 'test@example.com', subject: '', content: 'body' } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('Email subject is empty');
  });

  it('sendEmailViaApi should throw if content is empty', async () => {
    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: '' } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('Email body is empty');
  });

  it('sendEmailViaApi should throw if subject is whitespace-only', async () => {
    const emailLog = { id: '1', recipient: 'test@example.com', subject: '   ', content: 'body' } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('Email subject is empty');
  });

  it('sendEmailViaApi should use SMTP fallback if no script URL', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(false);
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-1', accepted: ['test@example.com'], response: '250 OK' }),
    };
    mockSmtpService.getTransporter.mockReturnValue(mockTransporter);

    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: 'body', isHtml: false, relatedReportId: 'rpt-1' } as any;
    const res = await service.sendEmailViaApi(emailLog);

    expect(res.messageId).toBe('smtp-1');
    expect(res.responseCode).toBe(250);
    expect(mockTransporter.sendMail).toHaveBeenCalled();
  });

  it('sendEmailViaApi should handle HTML emails via SMTP', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(false);
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-html', accepted: ['test@example.com'], response: '250 OK' }),
    };
    mockSmtpService.getTransporter.mockReturnValue(mockTransporter);

    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: '<html>body</html>', isHtml: true } as any;
    const res = await service.sendEmailViaApi(emailLog);

    expect(res.messageId).toBe('smtp-html');
    const callArgs = mockTransporter.sendMail.mock.calls[0][0];
    expect(callArgs.html).toBe('<html>body</html>');
  });

  it('sendEmailViaApi should throw if SMTP transporter not initialized', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(false);
    mockSmtpService.getTransporter.mockReturnValue(null);

    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: 'body', isHtml: false } as any;
    await expect(service.sendEmailViaApi(emailLog)).rejects.toThrow('SMTP transport fallback is not initialized');
  });

  it('sendEmailViaApi should handle GAS failure and throw with status', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(true);
    mockSmtpService.sendMailViaGas.mockRejectedValue(new Error('Script timeout'));

    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: 'body', isHtml: true } as any;
    try {
      await service.sendEmailViaApi(emailLog);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('Google Apps Script error');
      expect(err.status).toBe(500);
    }
  });

  it('sendEmailViaApi should handle SMTP failure and throw with response code', async () => {
    mockSmtpService.hasScriptUrl.mockReturnValue(false);
    const smtpError = new Error('SMTP rejected') as any;
    smtpError.responseCode = 550;
    const mockTransporter = {
      sendMail: jest.fn().mockRejectedValue(smtpError),
    };
    mockSmtpService.getTransporter.mockReturnValue(mockTransporter);

    const emailLog = { id: '1', recipient: 'test@example.com', subject: 'subj', content: 'body', isHtml: false } as any;
    try {
      await service.sendEmailViaApi(emailLog);
      fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('Gmail SMTP fallback error');
      expect(err.status).toBe(550);
    }
  });

  it('findAll should return all email logs', async () => {
    mockEmailLogRepo.find.mockResolvedValue([{ id: '1' }, { id: '2' }]);
    const result = await service.findAll();
    expect(result).toHaveLength(2);
  });

  it('getTemplateService should return the template service', () => {
    const ts = service.getTemplateService();
    expect(ts).toBeDefined();
  });
});
