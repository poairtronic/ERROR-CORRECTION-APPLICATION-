import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
export declare class SalaryDeduction {
    id: string;
    report: DefectReport;
    reportId: string;
    operator: User;
    operatorId: string;
    amount: number;
    status: string;
    reason: string;
    monthRef: string;
    createdAt: Date;
}
