import { RecoveryStatus } from '../../common/enums/report-status.enum';
export declare class CreateVendorFaultDto {
    reportId: string;
    vendorId: string;
    note: string;
}
export declare class UpdateVendorFaultDto {
    recoveryStatus?: RecoveryStatus;
    recoveryAmount?: number;
    note?: string;
}
