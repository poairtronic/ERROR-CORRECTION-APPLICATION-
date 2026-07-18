import { GmailSmtpService } from './gmail-smtp.service';
import { ConfigService } from '@nestjs/config';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  }),
}));

// Mock retry utility
jest.mock('../../common/utils/retry', () => ({
  retryWithBackoff: jest.fn().mockImplementation(async (fn) => fn()),
}));

describe('GmailSmtpService', () => {
  let service: GmailSmtpService;
  let configService: Partial<ConfigService>;

  describe('with Google Apps Script URL', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockImplementation((key: string) => {
          const map: Record<string, string> = {
            GMAIL_SCRIPT_URL: 'https://script.google.com/test',
            GMAIL_SCRIPT_TOKEN: 'secret-token',
            EMAIL_FROM: 'noreply@test.com',
          };
          return map[key];
        }),
      };
      service = new GmailSmtpService(configService as ConfigService);
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with GAS URL', async () => {
      await service.onModuleInit();
      expect(service.hasScriptUrl()).toBe(true);
    });

    it('should return null transporter when using GAS', async () => {
      await service.onModuleInit();
      expect(service.getTransporter()).toBeNull();
    });
  });

  describe('with SMTP fallback', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockImplementation((key: string) => {
          const map: Record<string, string> = {
            EMAIL_FROM: 'noreply@test.com',
            GMAIL_APP_PASSWORD: 'app-password-123',
          };
          return map[key];
        }),
      };
      service = new GmailSmtpService(configService as ConfigService);
    });

    it('should initialize SMTP transport when no GAS URL', async () => {
      await service.onModuleInit();
      expect(service.hasScriptUrl()).toBe(false);
      expect(service.getTransporter()).toBeDefined();
    });
  });

  describe('with no email config', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockReturnValue(undefined),
      };
      service = new GmailSmtpService(configService as ConfigService);
    });

    it('should handle missing config gracefully', async () => {
      await service.onModuleInit();
      expect(service.hasScriptUrl()).toBe(false);
    });
  });

  describe('hasScriptUrl', () => {
    it('should return false before initialization', () => {
      configService = { get: jest.fn().mockReturnValue(undefined) };
      service = new GmailSmtpService(configService as ConfigService);
      expect(service.hasScriptUrl()).toBe(false);
    });
  });

  describe('sendMailViaGas', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockImplementation((key: string) => {
          const map: Record<string, string> = {
            GMAIL_SCRIPT_URL: 'https://script.google.com/test',
            GMAIL_SCRIPT_TOKEN: 'secret-token',
          };
          return map[key];
        }),
      };
      service = new GmailSmtpService(configService as ConfigService);
    });

    it('should throw if script URL is not configured', async () => {
      // Without init, scriptUrl is null
      await expect(
        service.sendMailViaGas('test@example.com', 'Subject', '<p>body</p>', true, 'ECR'),
      ).rejects.toThrow('GMAIL_SCRIPT_URL is not configured');
    });

    it('should send email via GAS when configured', async () => {
      await service.onModuleInit();

      // Mock fetch
      const { retryWithBackoff } = require('../../common/utils/retry');
      retryWithBackoff.mockImplementation(async (fn: any) => {
        return { status: 200, text: () => Promise.resolve(JSON.stringify({ status: 'ok', messageId: 'gas-123' })) };
      });

      const result = await service.sendMailViaGas('test@example.com', 'Test', '<p>body</p>', true, 'ECR');
      expect(result.messageId).toBe('gas-123');
      expect(result.responseCode).toBe(200);
    });
  });
});
