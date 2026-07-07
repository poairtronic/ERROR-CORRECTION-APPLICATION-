import { DefectReportsService } from './defect-reports.service';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
export declare class DefectReportsController {
    private service;
    constructor(service: DefectReportsService);
    create(dto: CreateDefectReportDto, user: any): Promise<import("./defect-report.entity").DefectReport>;
    findAll(status?: string, mine?: string, user?: any): Promise<import("./defect-report.entity").DefectReport[]>;
    findOne(id: string): Promise<import("./defect-report.entity").DefectReport>;
    inspect(id: string, dto: InspectReportDto, user: any): Promise<import("./defect-report.entity").DefectReport>;
    smReview(id: string, dto: SmReviewDto, user: any): Promise<import("./defect-report.entity").DefectReport>;
    gmApprove(id: string, dto: GmApproveDto, user: any): Promise<import("./defect-report.entity").DefectReport>;
    editField(id: string, body: {
        field: string;
        value: string;
    }, user: any): Promise<import("./defect-report.entity").DefectReport>;
    uploadImages(id: string, files: Express.Multer.File[], user: any): Promise<import("./defect-report.entity").DefectReport>;
    deleteImage(id: string, body: {
        imageUrl: string;
    }, user: any): Promise<import("./defect-report.entity").DefectReport>;
    transitionStatus(id: string, body: {
        status: string;
        note: string;
    }, user: any): Promise<import("./defect-report.entity").DefectReport>;
    issueComponents(id: string, body: {
        remarks: string;
    }, user: any): Promise<import("./defect-report.entity").DefectReport>;
}
