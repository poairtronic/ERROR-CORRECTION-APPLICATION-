import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Notification } from './notification.entity';
import { NotificationChannel } from '../common/enums/report-status.enum';
export declare class NotificationsService {
    private repo;
    private config;
    private readonly logger;
    private transporter;
    constructor(repo: Repository<Notification>, config: ConfigService);
    send(params: {
        userId: string;
        userEmail: string;
        reportId?: string;
        channel: NotificationChannel;
        type: string;
        message: string;
    }): Promise<Notification>;
    private attemptDelivery;
    retryFailed(maxAttempts?: number): Promise<{
        retried: number;
    }>;
    findForUser(userId: string, unreadOnly?: boolean): Promise<Notification[]>;
    markRead(id: string): Promise<void>;
    markDelivered(id: string): Promise<void>;
}
