import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsyncLocalStorage } from 'async_hooks';
import * as dns from 'dns';
import * as net from 'net';
import * as tls from 'tls';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { retryWithBackoff } from '../../common/utils/retry';

export const smtpAbortStorage = new AsyncLocalStorage<AbortSignal | undefined>();

@Injectable()
export class GmailSmtpService implements OnModuleInit {
  private readonly logger = new Logger(GmailSmtpService.name);
  private transporter: nodemailer.Transporter | null = null;
  private scriptUrl: string | null = null;
  private secretToken?: string;
  private gasQuotaExceededUntil = 0;

  constructor(private readonly configService: ConfigService) {
    this.secretToken = this.configService.get<string>('GMAIL_SCRIPT_TOKEN');
  }

  async onModuleInit() {
    try {
      dns.setDefaultResultOrder('ipv4first');
    } catch {
      // Ignored if unsupported
    }

    this.scriptUrl = this.configService.get<string>('GMAIL_SCRIPT_URL') || null;
    this.secretToken = this.configService.get<string>('GMAIL_SCRIPT_TOKEN');

    if (this.scriptUrl && this.secretToken) {
      this.logger.log('Gmail HTTP Service initialized using Google Apps Script Web App.');
    } else if (this.scriptUrl && !this.secretToken) {
      this.logger.warn('GMAIL_SCRIPT_URL is set but GMAIL_SCRIPT_TOKEN is missing.');
      this.scriptUrl = null;
    }

    // Always initialize SMTP transport (as primary or resilient fallback)
    this.logger.log('Initializing SMTP transport (direct Gmail fallback/primary)...');
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    const gmailAppPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (emailFrom && gmailAppPassword) {
      const smtpOptions: SMTPTransport.Options = {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        auth: {
          user: emailFrom,
          pass: gmailAppPassword,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        getSocket: (options: any, callback: (err: Error | null, socketOptions?: any) => void) => {
          const signal = smtpAbortStorage.getStore();
          if (!signal) {
            return setImmediate(() => callback(null, false));
          }
          if (signal.aborted) {
            const abortErr = new Error('SMTP request aborted due to shutdown') as any;
            abortErr.name = 'AbortError';
            abortErr.isShutdownAbort = true;
            abortErr.deliveryUncertain = false;
            return setImmediate(() => callback(abortErr));
          }

          const port = Number(options.port) || (options.secure ? 465 : 587);
          const host = options.host || 'localhost';
          let settled = false;

          const socket: net.Socket = options.secure
            ? tls.connect({ host, port, ...(options.tls || {}) })
            : net.connect({ host, port });

          const onAbort = () => {
            const abortErr = new Error('SMTP request aborted during shutdown') as any;
            abortErr.name = 'AbortError';
            abortErr.isShutdownAbort = true;
            abortErr.deliveryUncertain = true;
            socket.destroy(abortErr);
            if (!settled) {
              settled = true;
              callback(abortErr);
            }
          };

          signal.addEventListener('abort', onAbort, { once: true });
          socket.once('close', () => {
            signal.removeEventListener('abort', onAbort);
          });

          const connectEvent = options.secure ? 'secureConnect' : 'connect';
          socket.once(connectEvent, () => {
            if (!settled) {
              settled = true;
              callback(null, { connection: socket, secured: Boolean(options.secure) });
            }
          });
          socket.once('error', (err) => {
            signal.removeEventListener('abort', onAbort);
            if (!settled) {
              settled = true;
              callback(err);
            }
          });
        },
      } as SMTPTransport.Options & { getSocket?: any };
      this.transporter = nodemailer.createTransport(smtpOptions);
      try {
        await this.transporter.verify();
        this.logger.log('SMTP transport verified and ready (IPv4).');
      } catch (error: any) {
        this.logger.warn(`SMTP transport verification warning: ${error.message}`);
      }
    } else {
      this.logger.warn('SMTP transport not configured: GMAIL_APP_PASSWORD or EMAIL_FROM is missing.');
    }
  }

  isGasQuotaExceeded(): boolean {
    return Date.now() < this.gasQuotaExceededUntil;
  }

  markGasQuotaExceeded(durationMs: number = 6 * 60 * 60 * 1000): void {
    this.gasQuotaExceededUntil = Date.now() + durationMs;
    this.logger.warn(
      `[GAS_QUOTA_CIRCUIT_BREAKER] Google Apps Script quota circuit breaker TRIPPED until ${new Date(
        this.gasQuotaExceededUntil,
      ).toISOString()}. All emails will route to Direct Gmail SMTP.`
    );
  }

  clearGasQuotaExceeded(): void {
    this.gasQuotaExceededUntil = 0;
    this.logger.log('[GAS_QUOTA_CIRCUIT_BREAKER] Google Apps Script circuit breaker CLEARED.');
  }

  getPreferredProvider(): 'gas' | 'smtp' {
    const configuredPrimary = this.configService.get<string>('EMAIL_PRIMARY_PROVIDER')?.toLowerCase();
    if (configuredPrimary === 'smtp') {
      return 'smtp';
    }
    if (this.isGasQuotaExceeded()) {
      return 'smtp';
    }
    if (this.hasScriptUrl()) {
      return 'gas';
    }
    return 'smtp';
  }

  async sendMailViaGas(
    recipient: string,
    subject: string,
    content: string,
    isHtml: boolean,
    fromName: string,
    externalSignal?: AbortSignal,
  ): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    if (!this.scriptUrl) {
      const err = new Error('GMAIL_SCRIPT_URL is not configured') as any;
      err.isPermanent = true;
      err.status = 400;
      throw err;
    }

    const payload = {
      token: this.secretToken,
      recipient,
      subject,
      content,
      isHtml,
      fromName,
    };

    const requestTimeoutMs = Number(this.configService.get<string>('GAS_REQUEST_TIMEOUT_MS')) || 10000;

    const response = await retryWithBackoff(
      async () => {
        if (externalSignal?.aborted) {
          const abortErr = new Error('Email request aborted due to shutdown') as any;
          abortErr.name = 'AbortError';
          abortErr.isShutdownAbort = true;
          abortErr.deliveryUncertain = false;
          throw abortErr;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(new Error('GAS request timed out')), requestTimeoutMs);
        const onExternalAbort = () => controller.abort(externalSignal?.reason || new Error('Aborted'));
        externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

        try {
          const res = await fetch(this.scriptUrl!, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          if (res.status === 429 || res.status >= 500) {
            const retryErr = new Error(`Google Apps Script HTTP ${res.status}`) as any;
            retryErr.status = res.status;
            throw retryErr;
          }
          return res;
        } catch (fetchErr: any) {
          if (externalSignal?.aborted) {
            const abortErr = new Error('Google Apps Script request aborted during shutdown') as any;
            abortErr.name = 'AbortError';
            abortErr.isShutdownAbort = true;
            abortErr.deliveryUncertain = true;
            throw abortErr;
          }
          if (fetchErr?.name === 'AbortError' && !externalSignal?.aborted) {
            const timeoutErr = new Error(`Google Apps Script request timed out after ${requestTimeoutMs}ms`) as any;
            timeoutErr.code = 'ETIMEDOUT';
            timeoutErr.status = 504;
            throw timeoutErr;
          }
          throw fetchErr;
        } finally {
          clearTimeout(timeoutId);
          externalSignal?.removeEventListener('abort', onExternalAbort);
        }
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        exponential: true,
        jitter: true,
        retryable: (error: any) => {
          if (externalSignal?.aborted || error?.name === 'AbortError' || error?.isShutdownAbort || error?.isPermanent) {
            return false;
          }
          const status = error?.status;
          return !status || status === 429 || status >= 500;
        },
      },
      this.logger,
    );

    const responseBodyText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseBodyText);
    } catch (e) {
      const parseErr = new Error(`Invalid JSON response from Google Apps Script: ${responseBodyText}`) as any;
      parseErr.status = response.status >= 400 ? response.status : 502;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        parseErr.isPermanent = true;
      }
      throw parseErr;
    }

    if (response.status !== 200 || responseData.status === 'error') {
      const errMsg = responseData.message || responseBodyText;
      const isQuota =
        errMsg.includes('Service invoked too many times') ||
        errMsg.includes('quota exceeded') ||
        errMsg.includes('Limit Exceeded');
      if (isQuota) {
        this.markGasQuotaExceeded();
      }
      const gasErr = new Error(`Google Apps Script error: ${errMsg}`) as any;
      gasErr.status = response.status !== 200 ? response.status : isQuota ? 429 : 400;
      const lowerMsg = String(errMsg).toLowerCase();
      if (
        !isQuota &&
        ((gasErr.status >= 400 && gasErr.status < 500) ||
          lowerMsg.includes('unauthorized') ||
          lowerMsg.includes('invalid token') ||
          lowerMsg.includes('invalid email') ||
          lowerMsg.includes('missing recipient'))
      ) {
        gasErr.isPermanent = true;
      }
      throw gasErr;
    }

    return {
      messageId: responseData.messageId || `gas-${Date.now()}`,
      responseCode: response.status,
      responseBody: responseBodyText,
    };
  }

  async sendMailViaSmtp(
    mailOptions: nodemailer.SendMailOptions,
    externalSignal?: AbortSignal,
  ): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    if (!this.transporter) {
      throw new Error('SMTP transport is not initialized');
    }
    if (externalSignal?.aborted) {
      const abortErr = new Error('SMTP request aborted due to shutdown') as any;
      abortErr.name = 'AbortError';
      abortErr.isShutdownAbort = true;
      abortErr.deliveryUncertain = false;
      throw abortErr;
    }

    const transporter = this.transporter;
    let onAbort: (() => void) | undefined;
    const sendPromise = smtpAbortStorage.run(externalSignal, () => transporter.sendMail(mailOptions));
    sendPromise.catch(() => {});

    const info = await new Promise<any>((resolve, reject) => {
      if (externalSignal) {
        onAbort = () => {
          const abortErr = new Error('SMTP request aborted during shutdown') as any;
          abortErr.name = 'AbortError';
          abortErr.isShutdownAbort = true;
          abortErr.deliveryUncertain = true;
          reject(abortErr);
        };
        externalSignal.addEventListener('abort', onAbort, { once: true });
      }
      sendPromise.then(resolve, reject);
    }).finally(() => {
      if (externalSignal && onAbort) {
        externalSignal.removeEventListener('abort', onAbort);
      }
    });

    const messageId = info.messageId || `smtp-${Date.now()}`;
    return {
      messageId,
      responseCode: 250,
      responseBody: JSON.stringify({ accepted: info.accepted, response: info.response }),
    };
  }

  getTransporter(): nodemailer.Transporter | null {
    return this.transporter;
  }

  hasScriptUrl(): boolean {
    return !!this.scriptUrl && !!this.secretToken;
  }
}
