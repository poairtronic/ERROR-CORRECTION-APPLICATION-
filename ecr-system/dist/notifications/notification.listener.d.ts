import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { ReportStatus } from '../common/enums/report-status.enum';
import { NotificationsService } from './notifications.service';
interface StatusChangedEvent {
    reportId: string;
    reportNo: string;
    status: ReportStatus;
}
export declare class NotificationListener {
    private usersRepo;
    private reportsRepo;
    private notificationsService;
    private readonly logger;
    constructor(usersRepo: Repository<User>, reportsRepo: Repository<DefectReport>, notificationsService: NotificationsService);
    private fetchReportWithRelations;
    handleStatusChanged(event: StatusChangedEvent): Promise<void>;
    private handlePendingSmReview;
    private handlePendingGmApproval;
    private handleApproved;
    private handleRejected;
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
