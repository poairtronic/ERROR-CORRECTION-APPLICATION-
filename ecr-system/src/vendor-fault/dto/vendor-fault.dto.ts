import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional, Min } from 'class-validator';
import { RecoveryStatus } from '../../common/enums/report-status.enum';

export class CreateVendorFaultDto {
  @IsString()
  @IsNotEmpty()
  reportId: string;

  @IsString()
  @IsNotEmpty()
  vendorId: string;

  @IsString()
  @IsNotEmpty()
  note: string;
}

export class UpdateVendorFaultDto {
  @IsEnum(RecoveryStatus)
  @IsOptional()
  recoveryStatus?: RecoveryStatus;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  recoveryAmount?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
