import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
export declare class SmReview {
    id: string;
    report: DefectReport;
    reportId: string;
    seniorManager: User;
    smId: string;
    loopholeNote: string;
    decisionNote: string;
    biasedFlag: boolean;
    forwardedToGm: boolean;
    reviewedAt: Date;
}
