export declare class CreateDefectReportDto {
    scOrPoNo: string;
    productId?: string;
    stageOfFailure: string;
    defectDescription: string;
    componentId?: string;
    errorTypeId?: string;
    partNumber?: string;
    batchNumber?: string;
    quantity?: number;
    images?: string[];
    inlineInspection?: {
        errorType: string;
        rootCause: string;
        responsibleParty: string;
        responsibleId?: string;
        decision: string;
        alternativeNote?: string;
        costEstimate: number;
        timeEstimateHours: number;
        lossAmount?: number;
    };
    inlineSmReview?: {
        loopholeNote: string;
        decisionNote: string;
        biasedFlag?: boolean;
    };
}
