import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
import { Decision, ResponsibleParty } from '../common/enums/report-status.enum';
export declare class InspectionDetail {
    id: string;
    report: DefectReport;
    reportId: string;
    inspector: User;
    inspectorId: string;
    errorType: string;
    rootCause: string;
    responsibleParty: ResponsibleParty;
    responsibleId: string;
    decision: Decision;
    alternativeNote: string;
    costEstimate: number;
    timeEstimateHours: number;
    lossAmount: number;
    reviewedAt: Date;
}
