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
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: false,
      requireTLS: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
      tls: {
        rejectUnauthorized: false
      },
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async onModuleInit() {
    const requiredEnv = ['EMAIL_FROM', 'SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT'];
    for (const val of requiredEnv) {
      if (!process.env[val]) {
        throw new Error(`Email startup validation failed: Missing required environment variable [${val}]`);
      }
    }

    try {
      await this.transporter.verify();
      this.logger.log("SMTP verified");
    } catch (error) {
      this.logger.error(error);
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

      console.log("===== EMAIL QUEUE DEBUG =====");
      console.log("Recipient:", options.recipient);
      console.log("Subject:", options.subject);
      console.log("Related Report:", options.relatedReportId);

      savedLog = await this.emailLogRepo.save(emailLog);

      console.log("EmailLog ID:", savedLog.id);
      console.log("Status:", savedLog.status);
      console.log("============================");

      console.log(`[EMAIL_DIAGNOSTICS] [STEP 4] Queue Created: Email log queued in database as PENDING (Log ID: ${savedLog.id})`);
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to queue email record in database.\nReason: ${error.message}\nFile: email.service.ts\nMethod: queueEmail\nStack: ${error.stack}\nConfig: host=${this.configService.get('SMTP_HOST')}, port=${this.configService.get('SMTP_PORT')}, user=${this.configService.get('SMTP_USER')}`);
      throw error;
    }

    return savedLog;
  }

  async resend(id: string): Promise<EmailLog> {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new Error('Email log not found');
    }
    email.status = EmailStatus.PENDING;
    email.retryCount = 0;
    email.failureReason = null as any;
    return this.emailLogRepo.save(email);
  }

  findAll() {
    return this.emailLogRepo.find({ order: { createdAt: 'DESC' } });
  }
}
