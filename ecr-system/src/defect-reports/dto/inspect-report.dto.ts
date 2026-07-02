import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';
import { Decision, ResponsibleParty } from '../../common/enums/report-status.enum';

export class InspectReportDto {
  @IsNotEmpty()
  errorType: string;

  @IsNotEmpty()
  rootCause: string;

  @IsEnum(ResponsibleParty)
  responsibleParty: ResponsibleParty;

  @IsOptional()
  responsibleId?: string;

  @IsEnum(Decision)
  decision: Decision;

  @IsOptional()
  alternativeNote?: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  costEstimate: number;

  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  timeEstimateHours: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lossAmount?: number;
}
