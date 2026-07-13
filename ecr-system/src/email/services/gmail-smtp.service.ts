import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class GmailSmtpService implements OnModuleInit {
  private readonly logger = new Logger(GmailSmtpService.name);
  private transporter: nodemailer.Transporter | null = null;
  private scriptUrl: string | null = null;
  private secretToken: string;

  constructor(private readonly configService: ConfigService) {
    this.secretToken = this.configService.get<string>('GMAIL_SCRIPT_TOKEN') || 'ecr_secret_secure_mail_token_2026';
  }

  async onModuleInit() {
    this.scriptUrl = this.configService.get<string>('GMAIL_SCRIPT_URL') || null;

    if (this.scriptUrl) {
      this.logger.log('Gmail HTTP Service initialized using Google Apps Script Web App.');
      return;
    }

    // SMTP Fallback for local development
    this.logger.log('No GMAIL_SCRIPT_URL found. Initializing SMTP transport fallback for local development...');
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
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      };
      this.transporter = nodemailer.createTransport(smtpOptions);
      try {
        await this.transporter.verify();
        this.logger.log('SMTP transport fallback verified and ready.');
      } catch (error: any) {
        this.logger.warn(`SMTP transport verification failed: ${error.message}`);
      }
    } else {
      this.logger.warn('SMTP fallback not configured. GMAIL_APP_PASSWORD or EMAIL_FROM is missing.');
    }
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

    const response = await fetch(this.scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBodyText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseBodyText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Google Apps Script: ${responseBodyText}`);
    }

    if (response.status !== 200 || responseData.status === 'error') {
      throw new Error(`Google Apps Script error: ${responseData.message || responseBodyText}`);
    }

    return {
      messageId: responseData.messageId || `gas-${Date.now()}`,
      responseCode: response.status,
      responseBody: responseBodyText,
    };
  }

  getTransporter(): nodemailer.Transporter | null {
    return this.transporter;
  }

  hasScriptUrl(): boolean {
    return !!this.scriptUrl;
  }
}
