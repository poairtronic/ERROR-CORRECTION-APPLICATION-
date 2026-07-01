import { IsNotEmpty, IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';
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
  @IsOptional()
  recoveryAmount?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
