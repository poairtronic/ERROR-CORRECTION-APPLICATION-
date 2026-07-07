import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import { ReportStatus } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
interface ActingUser {
    id: string;
    role: Role;
}
export declare class DefectReportsService implements OnModuleInit {
    private reportsRepo;
    private inspectionRepo;
    private smReviewRepo;
    private gmApprovalRepo;
    private auditRepo;
    private events;
    private imageUploadService;
    constructor(reportsRepo: Repository<DefectReport>, inspectionRepo: Repository<InspectionDetail>, smReviewRepo: Repository<SmReview>, gmApprovalRepo: Repository<GmApproval>, auditRepo: Repository<AuditLog>, events: EventEmitter2, imageUploadService: ImageUploadService);
    onModuleInit(): Promise<void>;
    private generateReportNumber;
    private logStatusChange;
    private emitStatusChange;
    create(dto: CreateDefectReportDto, actor: ActingUser): Promise<DefectReport>;
    private mapRoleToRaisedBy;
    findOne(id: string): Promise<DefectReport>;
    findAll(filters: {
        status?: string;
        raisedById?: string;
    }): Promise<DefectReport[]>;
    inspect(reportId: string, dto: InspectReportDto, actor: ActingUser): Promise<DefectReport>;
    smReview(reportId: string, dto: SmReviewDto, actor: ActingUser): Promise<DefectReport>;
    gmApprove(reportId: string, dto: GmApproveDto, actor: ActingUser): Promise<DefectReport>;
    editField(reportId: string, field: string, newValue: string, actor: ActingUser): Promise<DefectReport>;
    uploadImages(reportId: string, files: Express.Multer.File[], actor: ActingUser): Promise<DefectReport>;
    deleteImage(reportId: string, imageUrl: string, actor: ActingUser): Promise<DefectReport>;
    transitionStatus(reportId: string, newStatus: ReportStatus, note: string, actor: ActingUser): Promise<DefectReport>;
    issueComponents(reportId: string, dto: {
        remarks: string;
    }, actor: ActingUser): Promise<DefectReport>;
}
export {};
