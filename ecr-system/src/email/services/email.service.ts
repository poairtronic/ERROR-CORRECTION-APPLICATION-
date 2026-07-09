import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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

  constructor(
    @InjectRepository(EmailLog) private emailLogRepo: Repository<EmailLog>,
    private configService: ConfigService,
    private templateService: EmailTemplateService,
  ) {}

  async onModuleInit() {
    const requiredEnv = ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME'];
    for (const val of requiredEnv) {
      if (!this.configService.get<string>(val)) {
        throw new Error(`Email startup validation failed: Missing required environment variable [${val}]`);
      }
    }
    this.logger.log("Brevo API config validated successfully");
  }

  async sendEmailViaApi(emailLog: EmailLog): Promise<{ messageId: string; responseCode: number; responseBody: string }> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
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
      `[EMAIL] [API Request] [${new Date().toISOString()}] ` +
      `Email ID: ${emailLog.id} | Report ID: ${emailLog.relatedReportId || 'N/A'} | ` +
      `Recipient: ${emailLog.recipient} | Provider: Brevo`
    );

    const headers: Record<string, string> = {
      'accept': 'application/json',
      'api-key': apiKey || '',
      'content-type': 'application/json',
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseCode = response.status;
    const responseBodyText = await response.text();
    const responseTime = Date.now() - startTime;

    console.log(
      `[EMAIL] [API Response] [${new Date().toISOString()}] ` +
      `Email ID: ${emailLog.id} | Report ID: ${emailLog.relatedReportId || 'N/A'} | ` +
      `Recipient: ${emailLog.recipient} | Response Code: ${responseCode} | ` +
      `Response Time: ${responseTime}ms | Provider: Brevo`
    );

    if (!response.ok) {
      const errorDetail = new Error(`Brevo API returned error ${responseCode}: ${responseBodyText}`);
      (errorDetail as any).status = responseCode;
      throw errorDetail;
    }

    let parsedBody: any = {};
    try {
      parsedBody = JSON.parse(responseBodyText);
    } catch (e) {
      parsedBody = { raw: responseBodyText };
    }

    const messageId = parsedBody.messageId || '';

    console.log(
      `[EMAIL] [Success] [${new Date().toISOString()}] ` +
      `Email ID: ${emailLog.id} | Report ID: ${emailLog.relatedReportId || 'N/A'} | ` +
      `Recipient: ${emailLog.recipient} | Message ID: ${messageId} | Provider: Brevo`
    );

    return {
      messageId,
      responseCode,
      responseBody: responseBodyText,
    };
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
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to queue email record in database.\nReason: ${error.message}\nFile: email.service.ts\nMethod: queueEmail\nStack: ${error.stack}`);
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

  getTemplateService() {
    return this.templateService;
  }

  findAll() {
    return this.emailLogRepo.find({ order: { createdAt: 'DESC' } });
  }
}
