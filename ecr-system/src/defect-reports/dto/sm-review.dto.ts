import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class SmReviewDto {
  @IsNotEmpty()
  @IsString()
  loopholeNote: string;

  @IsNumber()
  costEstimate: number;

  @IsOptional()
  @IsNumber()
  timeEstimateHours?: number;

  @IsOptional()
  @IsNumber()
  lossAmount?: number;

  @IsNotEmpty()
  @IsString()
  decisionNote: string;

  @IsOptional()
  @IsBoolean()
  biasedFlag?: boolean;

  // false = reject back, true = forward to GM
  @IsBoolean()
  forwardToGm: boolean;

  @IsOptional()
  @IsObject()
  rejectionStageCosts?: any;
}
