import { EmailTemplateService } from './email-template.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue('<div>{{body}}</div>'),
}));

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let configService: Partial<ConfigService>;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultVal?: string) => {
        const map: Record<string, string> = {
          EMAIL_FROM_NAME: 'Velan Metrology',
          EMAIL_FROM: 'noreply@velan.com',
        };
        return map[key] || defaultVal;
      }),
    };
    service = new EmailTemplateService(configService as ConfigService);
    // Clear cached templates
    (service as any).templates = new Map();
    (service as any).isPartialsRegistered = false;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('renderHtml', () => {
    it('should render HTML using layout and body templates', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('<div>{{body}}</div>');
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const data = {
        title: 'Test Title',
        message: 'Test message body',
      };

      const result = service.renderHtml('system-alert', data, '[ECR] Test');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should render system-alert with summaryTable as detailed table', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('<div>{{body}}</div>');
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const data = {
        title: 'Status Change',
        message: 'Report updated',
        summaryTable: {
          'Report Number': 'AGIPL-2026-ERR-00001',
          'Current Status': 'APPROVED',
          'Submitted By': 'TestUser',
        },
      };

      const result = service.renderHtml('system-alert', data, '[ECR] Update');
      expect(result).toBeDefined();
    });

    it('should render with primaryButton link', () => {
      (fs.readFileSync as jest.Mock).mockReturnValue('<div>{{body}}</div>');
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const data = {
        title: 'Action Required',
        message: 'Review needed',
        summaryTable: { 'Status': 'PENDING' },
        primaryButton: {
          text: 'View Report',
          url: 'http://localhost:5173/reports/rpt-1',
        },
      };

      const result = service.renderHtml('system-alert', data);
      expect(result).toBeDefined();
    });

    it('should fallback gracefully if template file not found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      // Reset cached templates
      (service as any).templates = new Map();
      (service as any).isPartialsRegistered = false;

      // The getTemplatePath will throw, but getCompiledTemplate has fallback
      // We need to ensure layout exists first
      let callCount = 0;
      (fs.existsSync as jest.Mock).mockImplementation(() => {
        callCount++;
        return callCount <= 4; // layout and partials exist, but specific template doesn't
      });

      const data = { title: 'Test', message: 'body' };
      // Should not throw due to fallback template
      expect(() => service.renderHtml('nonexistent-template', data)).not.toThrow();
    });
  });

  describe('renderText', () => {
    it('should render plain text with title and message', () => {
      const data = {
        title: 'Test Notification',
        message: 'You have a new update',
      };

      const result = service.renderText(data);
      expect(result).toContain('Test Notification');
      expect(result).toContain('You have a new update');
    });

    it('should include report details when available', () => {
      const data = {
        title: 'Report Update',
        message: 'Status changed',
        reportId: 'AGIPL-2026-ERR-00001',
        status: 'APPROVED',
        reviewer: 'John Doe',
      };

      const result = service.renderText(data);
      expect(result).toContain('AGIPL-2026-ERR-00001');
      expect(result).toContain('APPROVED');
      expect(result).toContain('John Doe');
    });

    it('should include timestamp', () => {
      const result = service.renderText({ title: 'Test' });
      expect(result).toContain('Generated at:');
    });
  });
});
