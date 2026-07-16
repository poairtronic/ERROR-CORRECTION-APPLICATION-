import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class GmApproveDto {
  @IsBoolean()
  approved: boolean;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsNumber()
  budgetApproved?: number;

  @IsOptional()
  @IsString()
  messageToSm?: string;
}
