import { NotificationsService } from './notifications.service';
export declare class NotificationsController {
    private service;
    constructor(service: NotificationsService);
    findMine(user: any, unread?: string): Promise<import("./notification.entity").Notification[]>;
    markRead(id: string): Promise<void>;
}
