import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
export declare class GmApproval {
    id: string;
    report: DefectReport;
    reportId: string;
    generalManager: User;
    gmId: string;
    approved: boolean;
    remarks: string;
    budgetApproved: number;
    approvedAt: Date;
}
