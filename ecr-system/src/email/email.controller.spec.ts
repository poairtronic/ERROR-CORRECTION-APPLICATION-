import { EmailController } from './email.controller';
import { EmailService } from './services/email.service';
import { GmailSmtpService } from './services/gmail-smtp.service';

describe('EmailController', () => {
  let controller: EmailController;
  let emailService: Partial<EmailService>;
  let gmailSmtpService: Partial<GmailSmtpService>;

  beforeEach(() => {
    emailService = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'e1', status: 'SENT', recipient: 'a@b.com', retryCount: 0, sentTime: new Date(), createdAt: new Date() },
      ]),
      queueEmail: jest.fn().mockResolvedValue({ id: 'e2' }),
      resend: jest.fn().mockResolvedValue({ id: 'e1', status: 'PENDING' }),
      getTemplateService: jest.fn().mockReturnValue({
        renderHtml: jest.fn().mockReturnValue('<html>preview</html>'),
      }),
    };
    gmailSmtpService = {
      hasScriptUrl: jest.fn().mockReturnValue(true),
      getTransporter: jest.fn().mockReturnValue(null),
    };
    controller = new EmailController(
      emailService as EmailService,
      gmailSmtpService as GmailSmtpService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLogs', () => {
    it('should return email logs', async () => {
      const result = await controller.getLogs();
      expect(emailService.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('getHealth', () => {
    it('should return health status with GAS provider', async () => {
      const result = await controller.getHealth();
      expect(result.smtpConnected).toBe(true);
      expect(result.smtpVerified).toBe(true);
      expect(result.provider).toBe('Gmail SMTP');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.emailsSent).toBe(1);
    });

    it('should handle health check when no GAS and no SMTP', async () => {
      (gmailSmtpService.hasScriptUrl as jest.Mock).mockReturnValue(false);
      (gmailSmtpService.getTransporter as jest.Mock).mockReturnValue(null);

      const result = await controller.getHealth();
      expect(result.smtpConnected).toBe(false);
      expect(result.errorDetail).toBe('SMTP transport fallback is not initialized');
    });
  });

  describe('sendTestEmail', () => {
    it('should queue a test email', async () => {
      const result = await controller.sendTestEmail('test@example.com');
      expect(emailService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'test@example.com',
          subject: 'Test Notification from ECR',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('should default to test@example.com if no recipient', async () => {
      const result = await controller.sendTestEmail(undefined as any);
      expect(emailService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: 'test@example.com' }),
      );
    });
  });

  describe('sendTestHtmlEmail', () => {
    it('should queue an HTML test email with summary table', async () => {
      const result = await controller.sendTestHtmlEmail('html@test.com');
      expect(emailService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'html@test.com',
          subject: 'HTML Test Notification',
          templateData: expect.objectContaining({
            summaryTable: expect.any(Object),
          }),
        }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('resendEmail', () => {
    it('should call resend on emailService', async () => {
      const result = await controller.resendEmail('e1');
      expect(emailService.resend).toHaveBeenCalledWith('e1');
      expect(result.success).toBe(true);
    });
  });

  describe('previewTemplate', () => {
    it('should render template preview HTML', async () => {
      const result = await controller.previewTemplate('system-alert');
      expect(emailService.getTemplateService).toHaveBeenCalled();
      expect(result).toBe('<html>preview</html>');
    });

    it('should return error HTML if template rendering fails', async () => {
      (emailService.getTemplateService as jest.Mock).mockReturnValue({
        renderHtml: jest.fn().mockImplementation(() => { throw new Error('Template not found'); }),
      });
      const result = await controller.previewTemplate('nonexistent');
      expect(result).toContain('Error Rendering Template');
    });
  });
});
