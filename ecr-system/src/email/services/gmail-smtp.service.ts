import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { retryWithBackoff } from '../../common/utils/retry';

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
      };
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
  ): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    if (!this.scriptUrl) {
      throw new Error('GMAIL_SCRIPT_URL is not configured');
    }

    const payload = {
      token: this.secretToken,
      recipient,
      subject,
      content,
      isHtml,
      fromName,
    };

    const response = await retryWithBackoff(
      async () => {
        return await fetch(this.scriptUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        exponential: true,
        jitter: true,
        retryable: (error: any) => {
          const status = error.status;
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
      throw new Error(`Invalid JSON response from Google Apps Script: ${responseBodyText}`);
    }

    if (response.status !== 200 || responseData.status === 'error') {
      const errMsg = responseData.message || responseBodyText;
      if (
        errMsg.includes('Service invoked too many times') ||
        errMsg.includes('quota exceeded') ||
        errMsg.includes('Limit Exceeded')
      ) {
        this.markGasQuotaExceeded();
      }
      throw new Error(`Google Apps Script error: ${errMsg}`);
    }

    return {
      messageId: responseData.messageId || `gas-${Date.now()}`,
      responseCode: response.status,
      responseBody: responseBodyText,
    };
  }

  async sendMailViaSmtp(
    mailOptions: nodemailer.SendMailOptions,
  ): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    if (!this.transporter) {
      throw new Error('SMTP transport is not initialized');
    }
    const info = await this.transporter.sendMail(mailOptions);
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
