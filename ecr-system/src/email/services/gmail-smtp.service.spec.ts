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

    it('should trip quota circuit breaker when GAS returns quota error', async () => {
      await service.onModuleInit();

      const { retryWithBackoff } = require('../../common/utils/retry');
      retryWithBackoff.mockImplementation(async () => ({
        status: 200,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              status: 'error',
              message: 'Exception: Service invoked too many times for one day: email.',
            }),
          ),
      }));

      await expect(
        service.sendMailViaGas('test@example.com', 'Test', '<p>body</p>', true, 'ECR'),
      ).rejects.toThrow('Service invoked too many times');

      expect(service.isGasQuotaExceeded()).toBe(true);
      expect(service.getPreferredProvider()).toBe('smtp');
    });
  });

  describe('with dual GAS and SMTP credentials', () => {
    beforeEach(() => {
      configService = {
        get: jest.fn().mockImplementation((key: string) => {
          const map: Record<string, string> = {
            GMAIL_SCRIPT_URL: 'https://script.google.com/test',
            GMAIL_SCRIPT_TOKEN: 'secret-token',
            EMAIL_FROM: 'noreply@test.com',
            GMAIL_APP_PASSWORD: 'app-password-123',
          };
          return map[key];
        }),
      };
      service = new GmailSmtpService(configService as ConfigService);
    });

    it('should initialize both GAS and direct SMTP transport', async () => {
      await service.onModuleInit();
      expect(service.hasScriptUrl()).toBe(true);
      expect(service.getTransporter()).toBeDefined();
      expect(service.getPreferredProvider()).toBe('gas');

      const nodemailer = require('nodemailer');
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        }),
      );
    });

    it('should abort hanging GAS fetch on timeout and cancel immediately on external shutdown AbortSignal (D-09)', async () => {
      const { retryWithBackoff } = require('../../common/utils/retry');
      retryWithBackoff.mockImplementation(async (fn: any) => fn());
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'GAS_REQUEST_TIMEOUT_MS') return '25';
        const map: Record<string, string> = {
          GMAIL_SCRIPT_URL: 'https://script.google.com/test',
          GMAIL_SCRIPT_TOKEN: 'secret-token',
          EMAIL_FROM: 'noreply@test.com',
          GMAIL_APP_PASSWORD: 'app-password-123',
        };
        return map[key];
      });
      await service.onModuleInit();

      const originalFetch = global.fetch;
      global.fetch = jest.fn((_url: any, init: any) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted') as any;
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        });
      }) as any;

      try {
        await expect(
          service.sendMailViaGas('test@example.com', 'Timeout Test', '<p>hi</p>', true, 'ECR'),
        ).rejects.toMatchObject({ code: 'ETIMEDOUT', status: 504 });

        const externalController = new AbortController();
        const promise = service.sendMailViaGas(
          'test@example.com',
          'Shutdown Abort Test',
          '<p>hi</p>',
          true,
          'ECR',
          externalController.signal,
        );
        externalController.abort(new Error('SIGTERM'));

        await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('real SMTP socket cancellation and multi-email concurrency (Task 5.2)', () => {
    it('should terminate only the aborted in-flight SMTP socket without cancelling other concurrent emails on the same transporter', async () => {
      const net = require('net');
      const actualNodemailer = jest.requireActual('nodemailer');
      const { smtpAbortStorage } = require('./gmail-smtp.service');

      let slowSocketClosed = false;
      let fastCompleted = false;
      let markSlowInFlight!: () => void;
      const slowInFlight = new Promise<void>((r) => {
        markSlowInFlight = r;
      });

      const server = net.createServer((socket: any) => {
        let buffer = '';
        let inData = false;
        let isSlow = false;
        socket.on('error', () => {
          // Expected ECONNRESET when client destroys aborted socket
        });
        socket.once('close', () => {
          if (isSlow) {
            slowSocketClosed = true;
          }
        });
        socket.write('220 localhost ESMTP Mock\r\n');

        socket.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf8');
          while (true) {
            const idx = buffer.indexOf('\r\n');
            if (idx === -1) break;
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);

            if (inData) {
              if (line === '.') {
                inData = false;
                if (isSlow) {
                  // Hold slow email open indefinitely until client destroys socket
                  markSlowInFlight();
                } else {
                  setTimeout(() => {
                    if (!socket.destroyed) {
                      fastCompleted = true;
                      socket.write('250 2.0.0 OK fast\r\n');
                    }
                  }, 50);
                }
              }
              continue;
            }

            if (/^EHLO/i.test(line)) {
              socket.write('250-localhost\r\n250 OK\r\n');
            } else if (/^MAIL FROM:/i.test(line)) {
              socket.write('250 2.1.0 OK\r\n');
            } else if (/^RCPT TO:/i.test(line)) {
              if (line.includes('slow@example.com')) {
                isSlow = true;
              }
              socket.write('250 2.1.5 OK\r\n');
            } else if (/^DATA$/i.test(line)) {
              inData = true;
              socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
            } else if (/^QUIT$/i.test(line)) {
              socket.write('221 Bye\r\n');
              socket.end();
            } else {
              socket.write('250 OK\r\n');
            }
          }
        });
      });

      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = server.address().port;

      const realTransporter = actualNodemailer.createTransport({
        host: '127.0.0.1',
        port,
        secure: false,
        ignoreTLS: true,
        socketTimeout: 10000,
        getSocket: (options: any, callback: any) => {
          const sig = smtpAbortStorage.getStore();
          if (!sig) return setImmediate(() => callback(null, false));
          const sock = net.connect({ host: options.host, port: options.port });
          const onAbort = () => {
            const abortErr = new Error('SMTP request aborted during shutdown') as any;
            abortErr.name = 'AbortError';
            abortErr.isShutdownAbort = true;
            abortErr.deliveryUncertain = true;
            sock.destroy(abortErr);
          };
          sig.addEventListener('abort', onAbort, { once: true });
          sock.once('close', () => sig.removeEventListener('abort', onAbort));
          sock.once('connect', () => callback(null, { connection: sock, secured: false }));
          sock.once('error', (err: any) => callback(err));
        },
      });

      const realSvc = new GmailSmtpService({ get: () => undefined } as any);
      (realSvc as any).transporter = realTransporter;

      const slowCtrl = new AbortController();
      const fastCtrl = new AbortController();

      try {
        const slowPromise = realSvc.sendMailViaSmtp(
          { from: 'a@test.com', to: 'slow@example.com', subject: 'Slow', text: 'body' },
          slowCtrl.signal,
        );
        const fastPromise = realSvc.sendMailViaSmtp(
          { from: 'a@test.com', to: 'fast@example.com', subject: 'Fast', text: 'body' },
          fastCtrl.signal,
        );

        await slowInFlight;
        slowCtrl.abort();

        await expect(slowPromise).rejects.toMatchObject({
          name: 'AbortError',
          isShutdownAbort: true,
          deliveryUncertain: true,
        });

        const fastResult = await fastPromise;
        expect(fastResult.responseCode).toBe(250);
        expect(fastCompleted).toBe(true);

        await new Promise((r) => setTimeout(r, 30));
        expect(slowSocketClosed).toBe(true);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
