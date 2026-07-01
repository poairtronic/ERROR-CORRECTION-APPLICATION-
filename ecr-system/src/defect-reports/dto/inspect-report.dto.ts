import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
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
}
