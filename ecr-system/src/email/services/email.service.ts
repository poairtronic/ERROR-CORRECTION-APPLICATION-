import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../enums/email-status.enum';
import { NotificationEvent } from '../enums/notification-event.enum';
import { EmailTemplateService, TemplateData } from './email-template.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';

export interface SendEmailOptions {
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
    private notificationsGateway: NotificationsGateway, // Reuse existing websocket
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465, // true for 465, false for other ports
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
      this.logger.error('SMTP Connection failed on startup', error.message);
      // We don't throw here to ensure application starts even if SMTP is down
    }
  }

  getTransporter() {
    return this.transporter;
  }

  /**
   * Queue an email to be sent asynchronously.
   * Emits a websocket event concurrently (reusing existing infra).
   */
  async queueEmail(options: SendEmailOptions): Promise<EmailLog> {
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
    });

    const savedLog = await this.emailLogRepo.save(emailLog);

    // Reuse existing Websocket for in-app notification
    try {
      this.notificationsGateway.server.emit('notification', {
        type: options.event,
        title: options.subject,
        message: options.templateData.message,
        recipient: options.recipient,
        reportId: options.relatedReportId,
      });
    } catch (error) {
      this.logger.warn(`Failed to emit websocket notification: ${error.message}`);
    }

    return savedLog;
  }
}
