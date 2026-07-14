import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification } from './notification.entity';
import {
  NotificationChannel,
  NotificationStatus,
} from '../common/enums/report-status.enum';
import { EmailService } from '../email/services/email.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEvent } from '../email/enums/notification-event.enum';
import { TemplateData } from '../email/services/email-template.service';

import { SocketRegistryService } from './socket-registry.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    private config: ConfigService,
    private registry: SocketRegistryService,
    @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
    @Inject(forwardRef(() => NotificationsGateway)) private gateway: NotificationsGateway,
  ) {}

  /** Creates the notification row and queues email + websocket push. */
  async create(params: {
    userId: string;
    userEmail: string;
    reportId?: string;
    channel: NotificationChannel;
    type: string;
    message: string;
    event: NotificationEvent;
    templateData: TemplateData;
    subject: string;
  }) {
    const isConnected = this.registry.isUserConnected(params.userId);
    const status = isConnected ? NotificationStatus.SENT : NotificationStatus.QUEUED;
    const sentAt = isConnected ? new Date() : undefined;

    const notification = await this.repo.save(
      this.repo.create({
        userId: params.userId,
        reportId: params.reportId,
        channel: params.channel,
        type: params.type,
        message: params.message,
        status,
        sentAt,
        attemptCount: 1,
      }),
    );
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 2] Notification Created: ID ${notification.id} for user ${params.userId}`);

    // 1. Push WebSocket
    try {
      await this.gateway.pushToUser(params.userId, {
        id: notification.id,
        type: params.event,
        title: params.subject,
        message: params.message,
        reportId: params.reportId,
      });
    } catch (err) {
      this.logger.warn(`Failed to emit websocket notification: ${err.message}`);
    }

    // 2. Queue Email
    if (params.channel === NotificationChannel.EMAIL || params.channel === NotificationChannel.APP_AND_EMAIL) {
      await this.emailService.queueEmail({
        notificationId: notification.id,
        recipient: params.userEmail,
        subject: params.subject,
        event: params.event,
        templateData: params.templateData,
        relatedReportId: params.reportId,
      });
    }

    return notification;
  }

  async retryFailed(maxAttempts = 3) {
    // Retry is now handled primarily by EmailQueueService for emails.
    // For websockets, offline sync fetches missed notifications.
    return { retried: 0 };
  }

  findForUser(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.read = false;
    return this.repo.find({ where, order: { createdAt: 'DESC' }, relations: ['report'] });
  }

  findByReport(reportId: string) {
    return this.repo.find({ where: { reportId }, order: { createdAt: 'ASC' } });
  }

  async markRead(id: string) {
    await this.repo.update(id, { read: true });
  }

  async markDelivered(id: string) {
    await this.repo.update(id, { status: NotificationStatus.DELIVERED });
  }
}
