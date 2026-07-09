import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class GmailSmtpService implements OnModuleInit {
  private readonly logger = new Logger(GmailSmtpService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    const emailFromName = this.configService.get<string>('EMAIL_FROM_NAME');
    const gmailAppPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (!emailFrom) {
      throw new Error('Email startup validation failed: Missing required environment variable [EMAIL_FROM]');
    }
    if (!emailFromName) {
      throw new Error('Email startup validation failed: Missing required environment variable [EMAIL_FROM_NAME]');
    }
    if (!gmailAppPassword) {
      throw new Error('Email startup validation failed: Missing required environment variable [GMAIL_APP_PASSWORD]');
    }

    // Use 'as any' to set 'family: 4' which forces IPv4
    // Render free tier cannot reach Gmail SMTP over IPv6 (ENETUNREACH)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      family: 4,
      auth: {
        user: emailFrom,
        pass: gmailAppPassword,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    } as any);

    // Verify the connection on startup (non-fatal — emails will retry via queue)
    try {
      await this.transporter.verify();
      this.logger.log('Gmail SMTP transporter verified and ready.');
    } catch (error: any) {
      this.logger.warn(`Gmail SMTP verification failed on startup (will retry on send): ${error.message}`);
    }
  }

  getTransporter(): nodemailer.Transporter {
    return this.transporter;
  }
}
