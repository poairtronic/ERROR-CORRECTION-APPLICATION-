import { IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min, IsString, IsObject } from 'class-validator';
import { Decision, ResponsibleParty } from '../../common/enums/report-status.enum';

export class InspectReportDto {
  @IsOptional()
  @IsIn(['REWORK', 'REJECTION'])
  inspectionType?: string;

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsOptional()
  @IsString()
  rootCause?: string;

  @IsEnum(ResponsibleParty)
  responsibleParty: ResponsibleParty;

  @IsOptional()
  @IsString()
  responsibleId?: string;

  @IsOptional()
  @IsEnum(Decision)
  decision?: Decision;

  @IsOptional()
  @IsString()
  alternativeNote?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  costEstimate: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  timeEstimateHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
