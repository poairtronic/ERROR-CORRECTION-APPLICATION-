import { IsEnum, IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min, IsString } from 'class-validator';
import { Decision, ResponsibleParty } from '../../common/enums/report-status.enum';

export class InspectReportDto {
  @IsOptional()
  @IsIn(['REWORK', 'REJECTION'])
  inspectionType?: string;

  @IsOptional()
  errorType?: string;

  @IsOptional()
  rootCause?: string;

  @IsEnum(ResponsibleParty)
  responsibleParty: ResponsibleParty;

  @IsOptional()
  responsibleId?: string;

  @IsOptional()
  @IsEnum(Decision)
  decision?: Decision;

  @IsOptional()
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
  rejectionStageCosts?: any;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;
}
