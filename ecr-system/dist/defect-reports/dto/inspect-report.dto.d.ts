import { Decision, ResponsibleParty } from '../../common/enums/report-status.enum';
export declare class InspectReportDto {
    errorType: string;
    rootCause: string;
    responsibleParty: ResponsibleParty;
    responsibleId?: string;
    decision: Decision;
    alternativeNote?: string;
    costEstimate: number;
    timeEstimateHours: number;
    lossAmount?: number;
}
