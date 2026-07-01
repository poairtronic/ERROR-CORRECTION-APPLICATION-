import { IsNotEmpty, IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateSalaryDeductionDto {
  @IsString()
  @IsNotEmpty()
  reportId: string;

  @IsString()
  @IsNotEmpty()
  operatorId: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsNotEmpty()
  monthRef: string;
}

export class UpdateSalaryDeductionStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['PENDING', 'APPROVED', 'CANCELLED', 'PAID'])
  status: string;
}
