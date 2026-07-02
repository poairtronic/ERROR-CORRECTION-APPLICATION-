import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDefectReportDto {
  @IsNotEmpty()
  scOrPoNo: string;

  @IsOptional()
  productId?: string;

  @IsNotEmpty()
  stageOfFailure: string;

  @IsNotEmpty()
  defectDescription: string;

  @IsOptional()
  componentId?: string; // Contains name from frontend

  @IsOptional()
  errorTypeId?: string; // Contains name from frontend

  @IsOptional()
  partNumber?: string;

  @IsOptional()
  batchNumber?: string;

  @IsOptional()
  quantity?: number;

  @IsOptional()
  @IsArray()
  images?: string[];

  // Only used when raisedByRole is INSPECTOR or SENIOR_MANAGER (single-form skip-ahead).
  // Inspector fills inspectionDetail inline; SM fills both inspectionDetail + smReview inline.
  @IsOptional()
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

  @IsOptional()
  inlineSmReview?: {
    loopholeNote: string;
    decisionNote: string;
    biasedFlag?: boolean;
  };
}
