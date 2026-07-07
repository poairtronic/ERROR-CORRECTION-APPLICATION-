import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification } from './notification.entity';
import { NotificationChannel } from '../common/enums/report-status.enum';
import { EmailService } from '../email/services/email.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationEvent } from '../email/enums/notification-event.enum';
import { TemplateData } from '../email/services/email-template.service';
export declare class NotificationsService {
    private repo;
    private config;
    private emailService;
    private gateway;
    private readonly logger;
    constructor(repo: Repository<Notification>, config: ConfigService, emailService: EmailService, gateway: NotificationsGateway);
    create(params: {
        userId: string;
        userEmail: string;
        reportId?: string;
        channel: NotificationChannel;
        type: string;
        message: string;
        event: NotificationEvent;
        templateData: TemplateData;
        subject: string;
    }): Promise<Notification>;
    retryFailed(maxAttempts?: number): Promise<{
        retried: number;
    }>;
    findForUser(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
    findByReport(reportId: string): Promise<Notification[]>;
    markRead(id: string): Promise<void>;
    markDelivered(id: string): Promise<void>;
}
