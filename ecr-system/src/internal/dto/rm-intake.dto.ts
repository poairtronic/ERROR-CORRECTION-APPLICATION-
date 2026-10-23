import { IsIn, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class RmIntakeDto {
  @IsIn(['REWORK', 'REJECTION'])
  type: 'REWORK' | 'REJECTION';

  @IsNotEmpty()
  @IsString()
  scNumber: string;

  @IsNotEmpty()
  @IsString()
  poNumber: string;

  @IsNotEmpty()
  @IsString()
  component: string;

  @IsInt()
  @Min(1)
  quantityAffected: number;

  @IsOptional()
  @IsString()
  stageOfFailure?: string;

  @IsOptional()
  @IsString()
  errorType?: string;

  @IsNotEmpty()
  @IsString()
  defectDescription: string;

  @IsOptional()
  @IsString()
  responsibleParty?: string;

  @IsOptional()
  @IsString()
  operatorName?: string;

  @IsOptional()
  @IsString()
  reworkDescription?: string;

  @IsOptional()
  @IsString()
  rejectionDescription?: string;

  @IsOptional()
  @IsString()
  rejectionProcessTemplate?: string;

  @IsOptional()
  @IsString()
  rejectionFailedStage?: string;

  @IsOptional()
  @IsObject()
  rejectionStageCosts?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  costEstimation?: number;

  @IsOptional()
  @IsNumber()
  lossEstimation?: number;

  @IsOptional()
  @IsString()
  alternativeNotes?: string;

  @IsNotEmpty()
  @IsString()
  raisedByName: string;
}
