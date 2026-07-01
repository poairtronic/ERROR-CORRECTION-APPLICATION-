import { DefectReport } from '../defect-reports/defect-report.entity';
import { User } from '../users/user.entity';
interface IssuedComponent {
    componentId: string;
    componentName: string;
    qty: number;
}
export declare class ComponentIssue {
    id: string;
    report: DefectReport;
    reportId: string;
    storeManager: User;
    storeManagerId: string;
    components: IssuedComponent[];
    issuedTo: User;
    issuedToId: string;
    remarks: string;
    issuedAt: Date;
}
export {};
