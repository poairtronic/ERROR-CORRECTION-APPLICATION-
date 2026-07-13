import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class SmReviewDto {
  @IsNotEmpty()
  loopholeNote: string;

  @IsNumber()
  costEstimate: number;

  @IsNumber()
  timeEstimateHours: number;

  @IsOptional()
  @IsNumber()
  lossAmount?: number;

  @IsNotEmpty()
  decisionNote: string;

  @IsOptional()
  @IsBoolean()
  biasedFlag?: boolean;

  // false = reject back, true = forward to GM
  @IsBoolean()
  forwardToGm: boolean;

  @IsOptional()
  rejectionStageCosts?: any;
}
