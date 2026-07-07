import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Notification } from './notification.entity';
import {
  NotificationChannel,
  NotificationStatus,
} from '../common/enums/report-status.enum';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    private config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: Number(this.config.get('SMTP_PORT')),
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
  }

  /** Creates the notification row and attempts immediate delivery. */
  async send(params: {
    userId: string;
    userEmail: string;
    reportId?: string;
    channel: NotificationChannel;
    type: string;
    message: string;
  }) {
    const notification = await this.repo.save(
      this.repo.create({
        userId: params.userId,
        reportId: params.reportId,
        channel: params.channel,
        type: params.type,
        message: params.message,
      }),
    );

    await this.attemptDelivery(notification, params.userEmail);
    return notification;
  }

  private async attemptDelivery(notification: Notification, email?: string) {
    try {
      if (notification.channel === NotificationChannel.EMAIL && email) {
        await this.transporter.sendMail({
          from: this.config.get('EMAIL_FROM'),
          to: email,
          subject: `ECR Notification: ${notification.type}`,
          text: notification.message,
        });
      }
      // APP channel delivery (Socket.IO emit) is handled by the gateway listener separately;
      // marking SENT here just means "queued for socket push", actual push is fire-and-forget.
      notification.status = NotificationStatus.SENT;
      notification.sentAt = new Date();
    } catch (err) {
      this.logger.warn(`Notification ${notification.id} delivery failed: ${err.message}`);
      notification.status = NotificationStatus.FAILED;
    }
    notification.attemptCount += 1;
    await this.repo.save(notification);
  }

  /** Called by the cron job every N minutes to retry FAILED notifications. */
  async retryFailed(maxAttempts = 3) {
    const failed = await this.repo.find({
      where: { status: NotificationStatus.FAILED },
      relations: ['user'],
      take: 50,
    });

    for (const n of failed) {
      if (n.attemptCount >= maxAttempts) continue;
      await this.attemptDelivery(n, n.user?.email);
    }
    return { retried: failed.length };
  }

  findForUser(userId: string, unreadOnly = false) {
    const where: any = { userId };
    if (unreadOnly) where.read = false;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  async markRead(id: string) {
    await this.repo.update(id, { read: true });
  }

  async markDelivered(id: string) {
    await this.repo.update(id, { status: NotificationStatus.DELIVERED });
  }
}
