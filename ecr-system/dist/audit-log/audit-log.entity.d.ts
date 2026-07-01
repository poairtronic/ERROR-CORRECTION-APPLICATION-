import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
export declare enum AuditActionType {
    STATUS_CHANGE = "STATUS_CHANGE",
    FIELD_EDIT = "FIELD_EDIT",
    INVENTORY_UPDATED = "INVENTORY_UPDATED",
    COMPONENT_ISSUED = "COMPONENT_ISSUED",
    SALARY_DEDUCTION_CREATED = "SALARY_DEDUCTION_CREATED",
    VENDOR_FAULT_CREATED = "VENDOR_FAULT_CREATED",
    IMAGE_UPLOADED = "IMAGE_UPLOADED"
}
export declare class AuditLog {
    id: string;
    report: DefectReport;
    reportId: string;
    actor: User;
    actorId: string;
    actorRole: string;
    actionType: AuditActionType;
    fieldName: string;
    oldValue: string;
    newValue: string;
    fromStatus: string;
    toStatus: string;
    note: string;
    timestamp: Date;
}
