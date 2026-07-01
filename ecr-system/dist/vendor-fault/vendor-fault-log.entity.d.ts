import { DefectReport } from '../defect-reports/defect-report.entity';
import { Vendor } from '../master-data/vendors/vendor.entity';
import { RecoveryStatus } from '../common/enums/report-status.enum';
export declare class VendorFaultLog {
    id: string;
    report: DefectReport;
    reportId: string;
    vendor: Vendor;
    vendorId: string;
    note: string;
    recoveryAmount: number;
    recoveryStatus: RecoveryStatus;
    raisedAt: Date;
    recoveredAt: Date;
}
