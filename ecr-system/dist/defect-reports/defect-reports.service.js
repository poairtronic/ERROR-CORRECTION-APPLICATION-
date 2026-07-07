"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefectReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const defect_report_entity_1 = require("./defect-report.entity");
const report_sequence_entity_1 = require("./report-sequence.entity");
const inspection_detail_entity_1 = require("../inspection/inspection-detail.entity");
const sm_review_entity_1 = require("../sm-review/sm-review.entity");
const gm_approval_entity_1 = require("../gm-approval/gm-approval.entity");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
const image_upload_service_1 = require("../image-upload/image-upload.service");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const role_enum_1 = require("../common/enums/role.enum");
let DefectReportsService = class DefectReportsService {
    constructor(reportsRepo, inspectionRepo, smReviewRepo, gmApprovalRepo, auditRepo, events, imageUploadService) {
        this.reportsRepo = reportsRepo;
        this.inspectionRepo = inspectionRepo;
        this.smReviewRepo = smReviewRepo;
        this.gmApprovalRepo = gmApprovalRepo;
        this.auditRepo = auditRepo;
        this.events = events;
        this.imageUploadService = imageUploadService;
    }
    async onModuleInit() {
        const reports = await this.reportsRepo.find({ order: { createdAt: 'ASC' } });
        for (const report of reports) {
            if (!report.reportNumber) {
                report.reportNumber = await this.generateReportNumber();
                await this.reportsRepo.save(report);
            }
        }
    }
    async generateReportNumber() {
        const year = new Date().getFullYear();
        return await this.reportsRepo.manager.transaction(async (manager) => {
            let seq = await manager.findOne(report_sequence_entity_1.ReportSequence, { where: { id: 'AGIPL' } });
            if (!seq) {
                seq = manager.create(report_sequence_entity_1.ReportSequence, { id: 'AGIPL', lastValue: 0 });
            }
            seq.lastValue += 1;
            await manager.save(seq);
            return `AGIPL-${year}-ERR-${String(seq.lastValue).padStart(5, '0')}`;
        });
    }
    async logStatusChange(reportId, actor, from, to, note) {
        await this.auditRepo.save(this.auditRepo.create({
            reportId,
            actorId: actor.id,
            actorRole: actor.role,
            actionType: audit_log_entity_1.AuditActionType.STATUS_CHANGE,
            fromStatus: from,
            toStatus: to,
            note,
        }));
    }
    emitStatusChange(report) {
        this.events.emit('report.status.changed', {
            reportId: report.id,
            reportNumber: report.reportNumber,
            status: report.status,
        });
    }
    async create(dto, actor) {
        const raisedByRole = this.mapRoleToRaisedBy(actor.role);
        const reportNumber = await this.generateReportNumber();
        const report = this.reportsRepo.create({
            reportNumber,
            raisedById: actor.id,
            raisedByRole,
            scOrPoNo: dto.scOrPoNo,
            productId: dto.productId,
            componentName: dto.componentId,
            errorTypeName: dto.errorTypeId,
            partNumber: dto.partNumber,
            batchNumber: dto.batchNumber,
            quantity: dto.quantity,
            stageOfFailure: dto.stageOfFailure,
            defectDescription: dto.defectDescription,
            images: dto.images ?? [],
            status: report_status_enum_1.ReportStatus.PENDING_INSPECTION,
        });
        if (raisedByRole === report_status_enum_1.RaisedByRole.OPERATOR) {
            report.status = report_status_enum_1.ReportStatus.PENDING_INSPECTION;
            await this.reportsRepo.save(report);
        }
        else if (raisedByRole === report_status_enum_1.RaisedByRole.INSPECTOR) {
            if (!dto.inlineInspection) {
                throw new common_1.BadRequestException('inlineInspection is required when Inspector raises a report');
            }
            report.status = report_status_enum_1.ReportStatus.PENDING_SM_REVIEW;
            await this.reportsRepo.save(report);
            await this.inspectionRepo.save(this.inspectionRepo.create({
                reportId: report.id,
                inspectorId: actor.id,
                errorType: dto.inlineInspection.errorType,
                rootCause: dto.inlineInspection.rootCause,
                responsibleParty: dto.inlineInspection.responsibleParty,
                responsibleId: dto.inlineInspection.responsibleId,
                decision: dto.inlineInspection.decision,
                alternativeNote: dto.inlineInspection.alternativeNote,
                costEstimate: dto.inlineInspection.costEstimate,
                timeEstimateHours: dto.inlineInspection.timeEstimateHours,
                lossAmount: dto.inlineInspection.lossAmount,
            }));
        }
        else if (raisedByRole === report_status_enum_1.RaisedByRole.SENIOR_MANAGER) {
            if (!dto.inlineInspection || !dto.inlineSmReview) {
                throw new common_1.BadRequestException('inlineInspection and inlineSmReview are required when Senior Manager raises a report');
            }
            report.status = report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL;
            await this.reportsRepo.save(report);
            await this.inspectionRepo.save(this.inspectionRepo.create({
                reportId: report.id,
                inspectorId: actor.id,
                errorType: dto.inlineInspection.errorType,
                rootCause: dto.inlineInspection.rootCause,
                responsibleParty: dto.inlineInspection.responsibleParty,
                responsibleId: dto.inlineInspection.responsibleId,
                decision: dto.inlineInspection.decision,
                alternativeNote: dto.inlineInspection.alternativeNote,
                costEstimate: dto.inlineInspection.costEstimate,
                timeEstimateHours: dto.inlineInspection.timeEstimateHours,
                lossAmount: dto.inlineInspection.lossAmount,
            }));
            await this.smReviewRepo.save(this.smReviewRepo.create({
                reportId: report.id,
                smId: actor.id,
                loopholeNote: dto.inlineSmReview.loopholeNote,
                decisionNote: dto.inlineSmReview.decisionNote,
                biasedFlag: dto.inlineSmReview.biasedFlag ?? false,
                forwardedToGm: true,
            }));
        }
        await this.logStatusChange(report.id, actor, report_status_enum_1.ReportStatus.DRAFT, report.status, 'Report raised');
        this.emitStatusChange(report);
        return report;
    }
    mapRoleToRaisedBy(role) {
        if (role === role_enum_1.Role.OPERATOR)
            return report_status_enum_1.RaisedByRole.OPERATOR;
        if (role === role_enum_1.Role.INSPECTOR)
            return report_status_enum_1.RaisedByRole.INSPECTOR;
        if (role === role_enum_1.Role.SENIOR_MANAGER)
            return report_status_enum_1.RaisedByRole.SENIOR_MANAGER;
        throw new common_1.BadRequestException('This role cannot raise a defect report');
    }
    async findOne(id) {
        const report = await this.reportsRepo.findOne({
            where: { id },
            relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues', 'auditLogs', 'auditLogs.actor'],
        });
        if (!report)
            throw new common_1.NotFoundException('Defect report not found');
        return report;
    }
    findAll(filters) {
        const where = {};
        if (filters.status)
            where.status = filters.status;
        if (filters.raisedById)
            where.raisedById = filters.raisedById;
        return this.reportsRepo.find({
            where,
            order: { createdAt: 'DESC' },
            relations: ['raisedBy', 'auditLogs', 'auditLogs.actor'],
        });
    }
    async inspect(reportId, dto, actor) {
        const report = await this.findOne(reportId);
        if (report.status !== report_status_enum_1.ReportStatus.PENDING_INSPECTION) {
            throw new common_1.BadRequestException('Report is not pending inspection');
        }
        if (report.raisedById === actor.id) {
            throw new common_1.BadRequestException('Cannot inspect a report you raised yourself');
        }
        let inspection = await this.inspectionRepo.findOne({ where: { reportId: report.id } });
        if (!inspection) {
            inspection = this.inspectionRepo.create({ reportId: report.id, report });
        }
        Object.assign(inspection, {
            inspectorId: actor.id,
            errorType: dto.errorType,
            rootCause: dto.rootCause,
            responsibleParty: dto.responsibleParty,
            responsibleId: dto.responsibleId,
            decision: dto.decision,
            alternativeNote: dto.alternativeNote,
            costEstimate: dto.costEstimate,
            timeEstimateHours: dto.timeEstimateHours,
            lossAmount: dto.lossAmount,
        });
        await this.inspectionRepo.save(inspection);
        const from = report.status;
        report.status = report_status_enum_1.ReportStatus.PENDING_SM_REVIEW;
        await this.reportsRepo.save(report);
        await this.logStatusChange(report.id, actor, from, report.status, 'Inspection complete');
        this.emitStatusChange(report);
        return report;
    }
    async smReview(reportId, dto, actor) {
        const report = await this.findOne(reportId);
        if (report.status !== report_status_enum_1.ReportStatus.PENDING_SM_REVIEW) {
            throw new common_1.BadRequestException('Report is not pending SM review');
        }
        if (report.raisedById === actor.id) {
            throw new common_1.BadRequestException('Cannot review a report you raised yourself');
        }
        let smReview = await this.smReviewRepo.findOne({ where: { reportId: report.id } });
        if (!smReview) {
            smReview = this.smReviewRepo.create({ reportId: report.id });
        }
        Object.assign(smReview, {
            smId: actor.id,
            loopholeNote: dto.loopholeNote,
            decisionNote: dto.decisionNote,
            biasedFlag: dto.biasedFlag ?? false,
            forwardedToGm: dto.forwardToGm,
        });
        await this.smReviewRepo.save(smReview);
        if (report.inspectionDetail) {
            const inspectFields = ['costEstimate', 'timeEstimateHours', 'lossAmount'];
            let changed = false;
            for (const field of inspectFields) {
                if (dto[field] !== report.inspectionDetail[field] && dto[field] !== undefined) {
                    await this.auditRepo.save(this.auditRepo.create({
                        reportId: report.id,
                        actorId: actor.id,
                        actorRole: actor.role,
                        actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
                        fieldName: field,
                        oldValue: String(report.inspectionDetail[field]),
                        newValue: String(dto[field]),
                        note: `Senior Manager edited ${field} during review`,
                    }));
                    report.inspectionDetail[field] = dto[field];
                    changed = true;
                }
            }
            if (changed) {
                await this.inspectionRepo.save(report.inspectionDetail);
            }
        }
        const from = report.status;
        report.status = dto.forwardToGm ? report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL : report_status_enum_1.ReportStatus.REJECTED;
        await this.reportsRepo.save(report);
        await this.logStatusChange(report.id, actor, from, report.status, dto.decisionNote);
        this.emitStatusChange(report);
        return report;
    }
    async gmApprove(reportId, dto, actor) {
        const report = await this.findOne(reportId);
        if (report.status !== report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL) {
            throw new common_1.BadRequestException('Report is not pending GM approval');
        }
        let gmApproval = await this.gmApprovalRepo.findOne({ where: { reportId: report.id } });
        if (!gmApproval) {
            gmApproval = this.gmApprovalRepo.create({ reportId: report.id });
        }
        Object.assign(gmApproval, {
            gmId: actor.id,
            approved: dto.approved,
            remarks: dto.remarks,
            budgetApproved: dto.budgetApproved,
        });
        await this.gmApprovalRepo.save(gmApproval);
        const from = report.status;
        report.status = dto.approved ? report_status_enum_1.ReportStatus.APPROVED : report_status_enum_1.ReportStatus.REJECTED;
        await this.reportsRepo.save(report);
        await this.logStatusChange(report.id, actor, from, report.status, dto.remarks);
        this.emitStatusChange(report);
        if (dto.approved && report.inspectionDetail) {
            if (report.inspectionDetail.responsibleParty === report_status_enum_1.ResponsibleParty.OPERATOR) {
                this.events.emit('report.approved.operator_fault', { report, gmId: actor.id });
            }
            else if (report.inspectionDetail.responsibleParty === report_status_enum_1.ResponsibleParty.VENDOR) {
                this.events.emit('report.approved.vendor_fault', { report, gmId: actor.id });
            }
        }
        return report;
    }
    async editField(reportId, field, newValue, actor) {
        const report = await this.findOne(reportId);
        const smAllowedFields = [
            'defectDescription',
            'stageOfFailure',
            'errorType',
            'rootCause',
            'decision',
            'loopholeNote',
            'costEstimate',
            'timeEstimateHours',
            'lossAmount',
            'decisionNote',
        ];
        if (actor.role === role_enum_1.Role.SENIOR_MANAGER && !smAllowedFields.includes(field)) {
            throw new common_1.BadRequestException('Senior Manager cannot edit this field');
        }
        if (actor.role !== role_enum_1.Role.SENIOR_MANAGER && actor.role !== role_enum_1.Role.GENERAL_MANAGER) {
            throw new common_1.BadRequestException('Only Senior Manager or General Manager can edit report data');
        }
        if (field === 'status') {
            throw new common_1.BadRequestException('Status cannot be manually edited through editField. Use transitionStatus instead.');
        }
        const inspectFields = ['costEstimate', 'timeEstimateHours', 'lossAmount'];
        let oldValue;
        if (inspectFields.includes(field)) {
            if (report.inspectionDetail) {
                oldValue = report.inspectionDetail[field];
                report.inspectionDetail[field] = Number(newValue);
                await this.inspectionRepo.save(report.inspectionDetail);
            }
        }
        else {
            oldValue = report[field];
            if (field in report) {
                report[field] = newValue;
                await this.reportsRepo.save(report);
            }
        }
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: actor.id,
            actorRole: actor.role,
            actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
            fieldName: field,
            oldValue: String(oldValue),
            newValue: String(newValue),
            note: `Edited by ${actor.role}`,
        }));
        return report;
    }
    async uploadImages(reportId, files, actor) {
        const report = await this.findOne(reportId);
        const urls = await this.imageUploadService.uploadMultipleImages(files);
        const oldImages = [...report.images];
        report.images.push(...urls);
        await this.reportsRepo.save(report);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: actor.id,
            actorRole: actor.role,
            actionType: audit_log_entity_1.AuditActionType.IMAGE_UPLOADED,
            fieldName: 'images',
            oldValue: JSON.stringify(oldImages),
            newValue: JSON.stringify(report.images),
            note: `Uploaded ${files.length} images`,
        }));
        return report;
    }
    async deleteImage(reportId, imageUrl, actor) {
        const report = await this.findOne(reportId);
        if (!report.images.includes(imageUrl)) {
            throw new common_1.BadRequestException('Image not found in report');
        }
        await this.imageUploadService.deleteImage(imageUrl);
        const oldImages = [...report.images];
        report.images = report.images.filter(img => img !== imageUrl);
        await this.reportsRepo.save(report);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: actor.id,
            actorRole: actor.role,
            actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
            fieldName: 'images',
            oldValue: JSON.stringify(oldImages),
            newValue: JSON.stringify(report.images),
            note: `Deleted image`,
        }));
        return report;
    }
    async transitionStatus(reportId, newStatus, note, actor) {
        const report = await this.findOne(reportId);
        const validTransitions = {
            [report_status_enum_1.ReportStatus.DRAFT]: [report_status_enum_1.ReportStatus.PENDING_INSPECTION, report_status_enum_1.ReportStatus.PENDING_SM_REVIEW, report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL],
            [report_status_enum_1.ReportStatus.PENDING_INSPECTION]: [report_status_enum_1.ReportStatus.PENDING_SM_REVIEW],
            [report_status_enum_1.ReportStatus.PENDING_SM_REVIEW]: [report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL, report_status_enum_1.ReportStatus.REJECTED],
            [report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL]: [report_status_enum_1.ReportStatus.APPROVED, report_status_enum_1.ReportStatus.REJECTED],
            [report_status_enum_1.ReportStatus.APPROVED]: [report_status_enum_1.ReportStatus.COMPONENTS_ISSUED, report_status_enum_1.ReportStatus.CLOSED],
            [report_status_enum_1.ReportStatus.COMPONENTS_ISSUED]: [report_status_enum_1.ReportStatus.REWORK_IN_PROGRESS, report_status_enum_1.ReportStatus.NEW_PRODUCTION, report_status_enum_1.ReportStatus.CLOSED],
            [report_status_enum_1.ReportStatus.REWORK_IN_PROGRESS]: [report_status_enum_1.ReportStatus.NEW_PRODUCTION, report_status_enum_1.ReportStatus.CLOSED],
            [report_status_enum_1.ReportStatus.NEW_PRODUCTION]: [report_status_enum_1.ReportStatus.CLOSED],
            [report_status_enum_1.ReportStatus.REJECTED]: [],
            [report_status_enum_1.ReportStatus.CLOSED]: [],
        };
        const allowedNext = validTransitions[report.status];
        if (!allowedNext || !allowedNext.includes(newStatus)) {
            throw new common_1.BadRequestException(`Invalid transition from ${report.status} to ${newStatus}`);
        }
        const from = report.status;
        report.status = newStatus;
        await this.reportsRepo.save(report);
        await this.logStatusChange(report.id, actor, from, report.status, note || 'Status transitioned manually');
        this.emitStatusChange(report);
        return report;
    }
    async issueComponents(reportId, dto, actor) {
        const report = await this.findOne(reportId);
        if (report.status !== report_status_enum_1.ReportStatus.APPROVED) {
            throw new common_1.BadRequestException('Report must be APPROVED before components can be issued.');
        }
        if (report.componentsIssued) {
            throw new common_1.BadRequestException('Components have already been issued for this report.');
        }
        const from = report.status;
        report.componentsIssued = true;
        report.componentsIssuedById = actor.id;
        report.componentsIssuedAt = new Date();
        report.issueRemarks = dto.remarks || '';
        report.status = report_status_enum_1.ReportStatus.COMPONENTS_ISSUED;
        await this.reportsRepo.save(report);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: actor.id,
            actorRole: actor.role,
            actionType: audit_log_entity_1.AuditActionType.COMPONENT_ISSUED,
            fromStatus: from,
            toStatus: report.status,
            note: dto.remarks || 'Components were issued by the Store Manager.',
        }));
        this.emitStatusChange(report);
        return report;
    }
};
exports.DefectReportsService = DefectReportsService;
exports.DefectReportsService = DefectReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(defect_report_entity_1.DefectReport)),
    __param(1, (0, typeorm_1.InjectRepository)(inspection_detail_entity_1.InspectionDetail)),
    __param(2, (0, typeorm_1.InjectRepository)(sm_review_entity_1.SmReview)),
    __param(3, (0, typeorm_1.InjectRepository)(gm_approval_entity_1.GmApproval)),
    __param(4, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2,
        image_upload_service_1.ImageUploadService])
], DefectReportsService);
//# sourceMappingURL=defect-reports.service.js.map