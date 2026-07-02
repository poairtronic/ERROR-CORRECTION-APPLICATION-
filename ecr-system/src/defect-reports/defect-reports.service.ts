import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { ImageUploadService } from '../image-upload/image-upload.service';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import {
  ReportStatus,
  RaisedByRole,
  ResponsibleParty,
} from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';

interface ActingUser {
  id: string;
  role: Role;
}

@Injectable()
export class DefectReportsService {
  constructor(
    @InjectRepository(DefectReport) private reportsRepo: Repository<DefectReport>,
    @InjectRepository(InspectionDetail) private inspectionRepo: Repository<InspectionDetail>,
    @InjectRepository(SmReview) private smReviewRepo: Repository<SmReview>,
    @InjectRepository(GmApproval) private gmApprovalRepo: Repository<GmApproval>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private events: EventEmitter2,
    private imageUploadService: ImageUploadService,
  ) {}

  private async nextReportNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.reportsRepo.count();
    return `DR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async logStatusChange(
    reportId: string,
    actor: ActingUser,
    from: ReportStatus,
    to: ReportStatus,
    note?: string,
  ) {
    await this.auditRepo.save(
      this.auditRepo.create({
        reportId,
        actorId: actor.id,
        actorRole: actor.role,
        actionType: AuditActionType.STATUS_CHANGE,
        fromStatus: from,
        toStatus: to,
        note,
      }),
    );
  }

  private emitStatusChange(report: DefectReport) {
    // NotificationListener resolves recipients by new status and sends app+email (queued via cron retry)
    this.events.emit('report.status.changed', {
      reportId: report.id,
      reportNo: report.reportNo,
      status: report.status,
    });
  }

  /**
   * Create a defect report. Raiser can be Operator, Inspector, or Senior Manager.
   * Skip-ahead rule:
   *  - Operator raises        -> PENDING_INSPECTION (normal flow)
   *  - Inspector raises       -> inline inspection required, skips to PENDING_SM_REVIEW
   *  - Senior Manager raises  -> inline inspection + inline SM review required, skips to PENDING_GM_APPROVAL
   */
  async create(dto: CreateDefectReportDto, actor: ActingUser) {
    const raisedByRole = this.mapRoleToRaisedBy(actor.role);
    const reportNo = await this.nextReportNo();

    const report = this.reportsRepo.create({
      reportNo,
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
      status: ReportStatus.PENDING_INSPECTION,
    });

    if (raisedByRole === RaisedByRole.OPERATOR) {
      report.status = ReportStatus.PENDING_INSPECTION;
      await this.reportsRepo.save(report);
    } else if (raisedByRole === RaisedByRole.INSPECTOR) {
      if (!dto.inlineInspection) {
        throw new BadRequestException(
          'inlineInspection is required when Inspector raises a report',
        );
      }
      report.status = ReportStatus.PENDING_SM_REVIEW;
      await this.reportsRepo.save(report);
      await this.inspectionRepo.save(
        this.inspectionRepo.create({
          reportId: report.id,
          inspectorId: actor.id,
          errorType: dto.inlineInspection.errorType,
          rootCause: dto.inlineInspection.rootCause,
          responsibleParty: dto.inlineInspection.responsibleParty as any,
          responsibleId: dto.inlineInspection.responsibleId,
          decision: dto.inlineInspection.decision as any,
          alternativeNote: dto.inlineInspection.alternativeNote,
        }),
      );
    } else if (raisedByRole === RaisedByRole.SENIOR_MANAGER) {
      if (!dto.inlineInspection || !dto.inlineSmReview) {
        throw new BadRequestException(
          'inlineInspection and inlineSmReview are required when Senior Manager raises a report',
        );
      }
      report.status = ReportStatus.PENDING_GM_APPROVAL;
      await this.reportsRepo.save(report);
      await this.inspectionRepo.save(
        this.inspectionRepo.create({
          reportId: report.id,
          inspectorId: actor.id, // SM stands in for inspection step
          errorType: dto.inlineInspection.errorType,
          rootCause: dto.inlineInspection.rootCause,
          responsibleParty: dto.inlineInspection.responsibleParty as any,
          responsibleId: dto.inlineInspection.responsibleId,
          decision: dto.inlineInspection.decision as any,
          alternativeNote: dto.inlineInspection.alternativeNote,
        }),
      );
      await this.smReviewRepo.save(
        this.smReviewRepo.create({
          reportId: report.id,
          smId: actor.id,
          loopholeNote: dto.inlineSmReview.loopholeNote,
          costEstimate: dto.inlineSmReview.costEstimate,
          timeEstimateHours: dto.inlineSmReview.timeEstimateHours,
          lossAmount: dto.inlineSmReview.lossAmount,
          decisionNote: dto.inlineSmReview.decisionNote,
          biasedFlag: dto.inlineSmReview.biasedFlag ?? false,
          forwardedToGm: true,
        }),
      );
    }

    await this.logStatusChange(report.id, actor, ReportStatus.DRAFT, report.status, 'Report raised');
    this.emitStatusChange(report);
    return report;
  }

  private mapRoleToRaisedBy(role: Role): RaisedByRole {
    if (role === Role.OPERATOR) return RaisedByRole.OPERATOR;
    if (role === Role.INSPECTOR) return RaisedByRole.INSPECTOR;
    if (role === Role.SENIOR_MANAGER) return RaisedByRole.SENIOR_MANAGER;
    throw new BadRequestException('This role cannot raise a defect report');
  }

  async findOne(id: string) {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
    });
    if (!report) throw new NotFoundException('Defect report not found');
    return report;
  }

  findAll(filters: { status?: string; raisedById?: string }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.raisedById) where.raisedById = filters.raisedById;
    return this.reportsRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['raisedBy'],
    });
  }

  /** Inspector reviews a report raised by an Operator. Cannot review own-raised report. */
  async inspect(reportId: string, dto: InspectReportDto, actor: ActingUser) {
    const report = await this.findOne(reportId);
    if (report.status !== ReportStatus.PENDING_INSPECTION) {
      throw new BadRequestException('Report is not pending inspection');
    }
    if (report.raisedById === actor.id) {
      throw new BadRequestException('Cannot inspect a report you raised yourself');
    }

    let inspection = await this.inspectionRepo.findOne({ where: { reportId: report.id } });
    if (!inspection) {
      inspection = this.inspectionRepo.create({ reportId: report.id });
    }
    Object.assign(inspection, {
      inspectorId: actor.id,
      errorType: dto.errorType,
      rootCause: dto.rootCause,
      responsibleParty: dto.responsibleParty,
      responsibleId: dto.responsibleId,
      decision: dto.decision,
      alternativeNote: dto.alternativeNote,
    });
    await this.inspectionRepo.save(inspection);

    const from = report.status;
    report.status = ReportStatus.PENDING_SM_REVIEW;
    await this.reportsRepo.save(report);
    await this.logStatusChange(report.id, actor, from, report.status, 'Inspection complete');
    this.emitStatusChange(report);
    return report;
  }

  /** Senior Manager reviews. Cannot review own-raised report (self-raised SM reports skip this stage entirely). */
  async smReview(reportId: string, dto: SmReviewDto, actor: ActingUser) {
    const report = await this.findOne(reportId);
    if (report.status !== ReportStatus.PENDING_SM_REVIEW) {
      throw new BadRequestException('Report is not pending SM review');
    }
    if (report.raisedById === actor.id) {
      throw new BadRequestException('Cannot review a report you raised yourself');
    }

    let smReview = await this.smReviewRepo.findOne({ where: { reportId: report.id } });
    if (!smReview) {
      smReview = this.smReviewRepo.create({ reportId: report.id });
    }
    Object.assign(smReview, {
      smId: actor.id,
      loopholeNote: dto.loopholeNote,
      costEstimate: dto.costEstimate,
      timeEstimateHours: dto.timeEstimateHours,
      lossAmount: dto.lossAmount,
      decisionNote: dto.decisionNote,
      biasedFlag: dto.biasedFlag ?? false,
      forwardedToGm: dto.forwardToGm,
    });
    await this.smReviewRepo.save(smReview);

    const from = report.status;
    report.status = dto.forwardToGm ? ReportStatus.PENDING_GM_APPROVAL : ReportStatus.REJECTED;
    await this.reportsRepo.save(report);
    await this.logStatusChange(report.id, actor, from, report.status, dto.decisionNote);
    this.emitStatusChange(report);
    return report;
  }

  /** GM approves or rejects. GM has unrestricted edit power up to this point (see editField). */
  async gmApprove(reportId: string, dto: GmApproveDto, actor: ActingUser) {
    const report = await this.findOne(reportId);
    if (report.status !== ReportStatus.PENDING_GM_APPROVAL) {
      throw new BadRequestException('Report is not pending GM approval');
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
    report.status = dto.approved ? ReportStatus.APPROVED : ReportStatus.REJECTED;
    await this.reportsRepo.save(report);
    await this.logStatusChange(report.id, actor, from, report.status, dto.remarks);
    this.emitStatusChange(report);

    if (dto.approved && report.inspectionDetail) {
      if (report.inspectionDetail.responsibleParty === ResponsibleParty.OPERATOR) {
        this.events.emit('report.approved.operator_fault', { report, gmId: actor.id });
      } else if (report.inspectionDetail.responsibleParty === ResponsibleParty.VENDOR) {
        this.events.emit('report.approved.vendor_fault', { report, gmId: actor.id });
      }
    }

    return report;
  }

  /**
   * Field-level edit for GM (unrestricted) or SM (scoped to fields up to SM stage).
   * Every edit is written to audit_log with old/new value - never silently overwritten.
   */
  async editField(
    reportId: string,
    field: string,
    newValue: string,
    actor: ActingUser,
  ) {
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

    if (actor.role === Role.SENIOR_MANAGER && !smAllowedFields.includes(field)) {
      throw new BadRequestException('Senior Manager cannot edit this field');
    }
    if (actor.role !== Role.SENIOR_MANAGER && actor.role !== Role.GENERAL_MANAGER) {
      throw new BadRequestException('Only Senior Manager or General Manager can edit report data');
    }

    if (field === 'status') {
      throw new BadRequestException('Status cannot be manually edited through editField. Use transitionStatus instead.');
    }

    const oldValue = (report as any)[field];
    if (field in report) {
      (report as any)[field] = newValue;
      await this.reportsRepo.save(report);
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: report.id,
        actorId: actor.id,
        actorRole: actor.role,
        actionType: AuditActionType.FIELD_EDIT,
        fieldName: field,
        oldValue: String(oldValue),
        newValue: String(newValue),
        note: `Edited by ${actor.role}`,
      }),
    );

    return report;
  }

  async uploadImages(reportId: string, files: Express.Multer.File[], actor: ActingUser) {
    const report = await this.findOne(reportId);
    
    // Upload files to Cloudinary
    const urls = await this.imageUploadService.uploadMultipleImages(files);
    
    const oldImages = [...report.images];
    report.images.push(...urls);
    
    await this.reportsRepo.save(report);
    
    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: report.id,
        actorId: actor.id,
        actorRole: actor.role,
        actionType: AuditActionType.IMAGE_UPLOADED,
        fieldName: 'images',
        oldValue: JSON.stringify(oldImages),
        newValue: JSON.stringify(report.images),
        note: `Uploaded ${files.length} images`,
      }),
    );
    
    return report;
  }

  async deleteImage(reportId: string, imageUrl: string, actor: ActingUser) {
    const report = await this.findOne(reportId);
    
    if (!report.images.includes(imageUrl)) {
      throw new BadRequestException('Image not found in report');
    }
    
    // Delete from Cloudinary
    await this.imageUploadService.deleteImage(imageUrl);
    
    const oldImages = [...report.images];
    report.images = report.images.filter(img => img !== imageUrl);
    
    await this.reportsRepo.save(report);
    
    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: report.id,
        actorId: actor.id,
        actorRole: actor.role,
        actionType: AuditActionType.FIELD_EDIT, // or a specific delete action
        fieldName: 'images',
        oldValue: JSON.stringify(oldImages),
        newValue: JSON.stringify(report.images),
        note: `Deleted image`,
      }),
    );
    
    return report;
  }

  async transitionStatus(reportId: string, newStatus: ReportStatus, note: string, actor: ActingUser) {
    const report = await this.findOne(reportId);
    
    // Workflow State Machine rules
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      [ReportStatus.DRAFT]: [ReportStatus.PENDING_INSPECTION, ReportStatus.PENDING_SM_REVIEW, ReportStatus.PENDING_GM_APPROVAL],
      [ReportStatus.PENDING_INSPECTION]: [ReportStatus.PENDING_SM_REVIEW],
      [ReportStatus.PENDING_SM_REVIEW]: [ReportStatus.PENDING_GM_APPROVAL, ReportStatus.REJECTED],
      [ReportStatus.PENDING_GM_APPROVAL]: [ReportStatus.APPROVED, ReportStatus.REJECTED],
      [ReportStatus.APPROVED]: [ReportStatus.COMPONENTS_ISSUED, ReportStatus.CLOSED],
      [ReportStatus.COMPONENTS_ISSUED]: [ReportStatus.REWORK_IN_PROGRESS, ReportStatus.NEW_PRODUCTION, ReportStatus.CLOSED],
      [ReportStatus.REWORK_IN_PROGRESS]: [ReportStatus.NEW_PRODUCTION, ReportStatus.CLOSED],
      [ReportStatus.NEW_PRODUCTION]: [ReportStatus.CLOSED],
      [ReportStatus.REJECTED]: [],
      [ReportStatus.CLOSED]: [],
    };

    const allowedNext = validTransitions[report.status];
    if (!allowedNext || !allowedNext.includes(newStatus)) {
      throw new BadRequestException(`Invalid transition from ${report.status} to ${newStatus}`);
    }

    const from = report.status;
    report.status = newStatus;
    
    await this.reportsRepo.save(report);
    await this.logStatusChange(report.id, actor, from, report.status, note || 'Status transitioned manually');
    this.emitStatusChange(report);
    
    return report;
  }
}
