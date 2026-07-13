import { IsArray, IsNotEmpty, IsOptional, IsString, IsNumber, IsBoolean, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class InlineInspectionDto {
  @IsOptional()
  @IsString()
  errorType?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsNotEmpty()
  @IsString()
  responsibleParty: string;

  @IsOptional()
  @IsString()
  responsibleId?: string;

  @IsOptional()
  @IsString()
  decision?: string;

  @IsOptional()
  @IsString()
  alternativeNote?: string;

  @IsOptional()
  @IsNumber()
  costEstimate?: number;

  @IsOptional()
  @IsNumber()
  timeEstimateHours?: number;

  @IsOptional()
  @IsNumber()
  lossAmount?: number;

  @IsOptional()
  @IsString()
  reworkDescription?: string;

  @IsOptional()
  @IsString()
  rejectionProcessTemplate?: string;

  @IsOptional()
  @IsString()
  rejectionFailedStage?: string;

  @IsOptional()
  @IsObject()
  rejectionStageCosts?: any;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;
}

export class InlineSmReviewDto {
  @IsNotEmpty()
  @IsString()
  loopholeNote: string;

  @IsNotEmpty()
  @IsString()
  decisionNote: string;

  @IsOptional()
  @IsBoolean()
  biasedFlag?: boolean;
}

export class CreateDefectReportDto {
  @IsOptional()
  @IsString()
  inspectionType?: string;

  @IsNotEmpty()
  @IsString()
  scOrPoNo: string;

  @IsOptional()
  @IsString()
  scNo?: string;

  @IsOptional()
  @IsString()
  poNo?: string;

  @IsOptional()
  @IsString()
  reworkDescription?: string;

  @IsOptional()
  @IsString()
  rejectionProcessTemplate?: string;

  @IsOptional()
  @IsString()
  rejectionFailedStage?: string;

  @IsOptional()
  @IsObject()
  rejectionStageCosts?: any;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsNotEmpty()
  @IsString()
  stageOfFailure: string;

  @IsNotEmpty()
  @IsString()
  defectDescription: string;

  @IsOptional()
  @IsString()
  componentId?: string; // Contains name from frontend

  @IsOptional()
  @IsString()
  errorTypeId?: string; // Contains name from frontend

  @IsOptional()
  @IsString()
  partNumber?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsArray()
  images?: string[];

  // Only used when raisedByRole is INSPECTOR or SENIOR_MANAGER (single-form skip-ahead).
  // Inspector fills inspectionDetail inline; SM fills both inspectionDetail + smReview inline.
  @IsOptional()
  @ValidateNested()
  @Type(() => InlineInspectionDto)
  inlineInspection?: InlineInspectionDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InlineSmReviewDto)
  inlineSmReview?: InlineSmReviewDto;
}
