export declare class CreateDefectReportDto {
    scOrPoNo: string;
    productId?: string;
    stageOfFailure: string;
    defectDescription: string;
    images?: string[];
    inlineInspection?: {
        errorType: string;
        rootCause: string;
        responsibleParty: string;
        responsibleId?: string;
        decision: string;
        alternativeNote?: string;
    };
    inlineSmReview?: {
        loopholeNote: string;
        costEstimate: number;
        timeEstimateHours: number;
        lossAmount?: number;
        decisionNote: string;
        biasedFlag?: boolean;
    };
}
