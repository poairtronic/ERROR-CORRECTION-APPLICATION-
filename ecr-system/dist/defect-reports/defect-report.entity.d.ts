import { User } from '../users/user.entity';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
export declare class DefectReport {
    id: string;
    reportNo: string;
    raisedBy: User;
    raisedById: string;
    raisedByRole: RaisedByRole;
    scOrPoNo: string;
    productId: string;
    stageOfFailure: string;
    defectDescription: string;
    images: string[];
    status: ReportStatus;
    inspectionDetail: InspectionDetail;
    smReview: SmReview;
    gmApproval: GmApproval;
    componentIssues: ComponentIssue[];
    createdAt: Date;
    updatedAt: Date;
}
