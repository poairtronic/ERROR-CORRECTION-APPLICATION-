import { NotificationsService } from './notifications.service';
export declare class NotificationRetryCron {
    private notificationsService;
    private readonly logger;
    constructor(notificationsService: NotificationsService);
    handleRetry(): Promise<void>;
}
