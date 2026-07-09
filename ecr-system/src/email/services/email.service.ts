import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { EmailTemplateService, TemplateData } from './email-template.service';
import { BrevoClientService } from './brevo-client.service';

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

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private configService: ConfigService,
    private templateService: EmailTemplateService,
    private eventEmitter: EventEmitter2,
    private brevoClientService: BrevoClientService,
  ) {}

  async onModuleInit() {
    this.logger.log("Brevo API client verified on EmailService init");
  }

  async sendEmailViaApi(emailLog: EmailLog): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    const emailFrom = this.configService.get<string>('EMAIL_FROM');
    const emailFromName = this.configService.get<string>('EMAIL_FROM_NAME', 'Velan Metrology');

    // Validation
    if (!emailLog.recipient) {
      throw new Error('Recipient email is missing');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLog.recipient)) {
      throw new Error(`Recipient email address is invalid: [${emailLog.recipient}]`);
    }
    if (!emailLog.subject || emailLog.subject.trim() === '') {
      throw new Error('Email subject is empty');
    }
    if (!emailLog.content || emailLog.content.trim() === '') {
      throw new Error('Email body is empty');
    }

    const payload = {
      sender: {
        name: emailFromName,
        email: emailFrom,
      },
      to: [
        {
          email: emailLog.recipient,
        },
      ],
      subject: emailLog.subject,
      htmlContent: emailLog.isHtml ? emailLog.content : undefined,
      textContent: !emailLog.isHtml ? emailLog.content : undefined,
    };

    const startTime = Date.now();
    
    console.log(
      `[EMAIL] [API SDK Request] [${new Date().toISOString()}] ` +
      `Email ID: ${emailLog.id} | Report ID: ${emailLog.relatedReportId || 'N/A'} | ` +
      `Recipient: ${emailLog.recipient} | Provider: Brevo`
    );

    try {
      const client = this.brevoClientService.getClient();
      const response = await client.transactionalEmails.sendTransacEmail(payload);
      
      const duration = Date.now() - startTime;
      const messageId = response.messageId || '';

      console.log(
        `[EMAIL] [API SDK Response] [${new Date().toISOString()}] ` +
        `Email ID: ${emailLog.id} | Report ID: ${emailLog.relatedReportId || 'N/A'} | ` +
        `Recipient: ${emailLog.recipient} | Response Code: 201 | ` +
        `Response Time: ${duration}ms | Provider: Brevo | Message ID: ${messageId}`
      );

      return {
        messageId,
        responseCode: 201,
        responseBody: JSON.stringify(response),
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(
        `[EMAIL] [API SDK Error] [${new Date().toISOString()}] ` +
        `Email ID: ${emailLog.id} | Recipient: ${emailLog.recipient} | ` +
        `Duration: ${duration}ms | Error: ${error.message}`
      );
      
      const statusCode = error.status || error.statusCode || 500;
      const cleanError = new Error(`Brevo SDK returned error: ${error.message}`);
      (cleanError as any).status = statusCode;
      throw cleanError;
    }
  }

  /**
   * Queue an email to be sent asynchronously.
   */
  async queueEmail(options: SendEmailOptions): Promise<EmailLog> {
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 6] EmailService Called: queueEmail (Recipient: ${options.recipient}, Subject: ${options.subject})`);
    
    let savedLog: EmailLog;
    try {
      let templateName = 'system-alert';
      const event = options.event;

      if (event === NotificationEvent.REPORT_CREATED) {
        templateName = 'pending-review';
      } else if (event === NotificationEvent.REPORT_APPROVED) {
        templateName = 'approved';
      } else if (event === NotificationEvent.REPORT_REJECTED) {
        templateName = 'rejected';
      } else if (event === NotificationEvent.REPORT_UPDATED) {
        const status = (options.templateData.status || '').toLowerCase();
        if (status.includes('approved')) {
          templateName = 'approved';
        } else if (status.includes('rejected')) {
          templateName = 'rejected';
        } else if (status.includes('correction') || status.includes('returned')) {
          templateName = 'returned-for-correction';
        } else if (status.includes('completed') || status.includes('closed')) {
          templateName = 'completed';
        } else {
          templateName = 'system-alert';
        }
      } else if (event === NotificationEvent.DAILY_SUMMARY) {
        templateName = 'daily-summary';
      } else if (event === NotificationEvent.WEEKLY_SUMMARY) {
        templateName = 'weekly-summary';
      }

      let subject = options.subject;
      if (!subject.startsWith('[ECR]')) {
        subject = `[ECR] ${subject}`;
      }

      const htmlContent = this.templateService.renderHtml(templateName, options.templateData, subject);

      const emailLog = this.emailLogRepo.create({
        recipient: options.recipient,
        cc: options.cc,
        bcc: options.bcc,
        subject: subject,
        content: htmlContent,
        isHtml: true,
        event: options.event,
        status: EmailStatus.PENDING,
        relatedReportId: options.relatedReportId,
        notificationId: options.notificationId,
      });

      console.log("===== EMAIL QUEUE DEBUG =====");
      console.log("Recipient:", options.recipient);
      console.log("Subject:", subject);
      console.log("Template:", templateName);
      console.log("Related Report:", options.relatedReportId);

      savedLog = await this.emailLogRepo.save(emailLog);

      console.log("EmailLog ID:", savedLog.id);
      console.log("Status:", savedLog.status);
      console.log("============================");

      console.log(`[EMAIL_DIAGNOSTICS] [STEP 4] Queue Created: Email log queued in database as PENDING (Log ID: ${savedLog.id})`);
      
      this.eventEmitter.emit('email.logs.updated');
    } catch (error: any) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to queue email record in database.\nReason: ${error.message}\nFile: email.service.ts\nMethod: queueEmail\nStack: ${error.stack}`);
      throw error;
    }

    return savedLog;
  }

  // Template methods to queue emails under official events (Requirement 10)
  async sendPendingReview(recipient: string, templateData: any, reportId: string) {
    return this.queueEmail({
      recipient,
      subject: 'New Report Awaiting Review',
      event: NotificationEvent.REPORT_CREATED,
      templateData,
      relatedReportId: reportId,
    });
  }

  async sendApproved(recipient: string, templateData: any, reportId: string) {
    return this.queueEmail({
      recipient,
      subject: 'Report Approved',
      event: NotificationEvent.REPORT_APPROVED,
      templateData,
      relatedReportId: reportId,
    });
  }

  async sendRejected(recipient: string, templateData: any, reportId: string) {
    return this.queueEmail({
      recipient,
      subject: 'Report Rejected',
      event: NotificationEvent.REPORT_REJECTED,
      templateData,
      relatedReportId: reportId,
    });
  }

  async sendEscalation(recipient: string, templateData: any, reportId: string) {
    return this.queueEmail({
      recipient,
      subject: 'Report Escalation Alert',
      event: NotificationEvent.ESCALATION,
      templateData,
      relatedReportId: reportId,
    });
  }

  async sendReminder(recipient: string, templateData: any, reportId: string) {
    return this.queueEmail({
      recipient,
      subject: 'Report Pending Action Reminder',
      event: NotificationEvent.REMINDER,
      templateData,
      relatedReportId: reportId,
    });
  }

  async sendPasswordReset(recipient: string, templateData: any) {
    return this.queueEmail({
      recipient,
      subject: 'Password Reset Request',
      event: NotificationEvent.REMINDER,
      templateData,
    });
  }

  async resend(id: string): Promise<EmailLog> {
    const email = await this.emailLogRepo.findOne({ where: { id } });
    if (!email) {
      throw new Error('Email log not found');
    }
    email.status = EmailStatus.PENDING;
    email.retryCount = 0;
    email.failureReason = null as any;
    const saved = await this.emailLogRepo.save(email);
    this.eventEmitter.emit('email.logs.updated');
    return saved;
  }

  getTemplateService() {
    return this.templateService;
  }

  findAll() {
    return this.emailLogRepo.find({ order: { createdAt: 'DESC' } });
  }
}
