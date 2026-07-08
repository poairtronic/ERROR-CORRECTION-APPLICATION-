import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { NotificationChannel, NotificationStatus } from '../common/enums/report-status.enum';
export declare class Notification {
    id: string;
    user: User;
    userId: string;
    report: DefectReport;
    reportId: string;
    channel: NotificationChannel;
    type: string;
    message: string;
    read: boolean;
    status: NotificationStatus;
    attemptCount: number;
    sentAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
