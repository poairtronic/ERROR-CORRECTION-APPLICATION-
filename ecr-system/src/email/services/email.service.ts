import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { EmailTemplateService, TemplateData } from './email-template.service';

export interface SendEmailOptions {
  notificationId?: string;
  recipient: string;
  cc?: string;
  bcc?: string;
  subject: string;
  event: NotificationEvent;
  templateData: TemplateData;
  relatedReportId?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private configService: ConfigService,
    private templateService: EmailTemplateService,
  ) {
    const smtpPort = Number(this.configService.get('SMTP_PORT') || 587);
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP Connection verified successfully');
    } catch (error) {
      this.logger.error(
        `SMTP Connection failed on startup. Host: ${this.configService.get('SMTP_HOST')}, Port: ${this.configService.get('SMTP_PORT')}, User: ${this.configService.get('SMTP_USER')}`,
        error.message,
      );
      // We don't throw here to ensure application starts even if SMTP is down
    }
  }

  getTransporter() {
    return this.transporter;
  }

  /**
   * Queue an email to be sent asynchronously.
   */
  async queueEmail(options: SendEmailOptions): Promise<EmailLog> {
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 6] EmailService Called: queueEmail (Recipient: ${options.recipient}, Subject: ${options.subject})`);
    
    let savedLog: EmailLog;
    try {
      const htmlContent = this.templateService.renderHtml(options.templateData);

      const emailLog = this.emailLogRepo.create({
        recipient: options.recipient,
        cc: options.cc,
        bcc: options.bcc,
        subject: options.subject,
        content: htmlContent,
        isHtml: true,
        event: options.event,
        status: EmailStatus.PENDING,
        relatedReportId: options.relatedReportId,
        notificationId: options.notificationId,
      });

      savedLog = await this.emailLogRepo.save(emailLog);
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 4] Queue Created: Email log queued in database as PENDING (Log ID: ${savedLog.id})`);
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to queue email record in database.\nReason: ${error.message}\nFile: email.service.ts\nMethod: queueEmail\nStack: ${error.stack}\nConfig: host=${this.configService.get('SMTP_HOST')}, port=${this.configService.get('SMTP_PORT')}, user=${this.configService.get('SMTP_USER')}`);
      throw error;
    }

    return savedLog;
  }

  findAll() {
    return this.emailLogRepo.find({ order: { createdAt: 'DESC' } });
  }
}
