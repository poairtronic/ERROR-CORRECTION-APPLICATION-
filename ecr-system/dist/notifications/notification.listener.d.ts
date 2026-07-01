import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { User } from '../users/user.entity';
import { ReportStatus } from '../common/enums/report-status.enum';
interface StatusChangedEvent {
    reportId: string;
    reportNo: string;
    status: ReportStatus;
}
export declare class NotificationListener {
    private usersRepo;
    private notificationsService;
    constructor(usersRepo: Repository<User>, notificationsService: NotificationsService);
    handleStatusChanged(event: StatusChangedEvent): Promise<void>;
    handleComponentIssued(payload: {
        reportId: string;
        issueId: string;
        issuedToId: string;
    }): Promise<void>;
    handleSalaryDeductionCreated(payload: {
        deductionId: string;
        operatorId: string;
        amount: number;
    }): Promise<void>;
    handleVendorFaultCreated(payload: {
        faultId: string;
        vendorId: string;
        reportId: string;
    }): Promise<void>;
}
export {};
