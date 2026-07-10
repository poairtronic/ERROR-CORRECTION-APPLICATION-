import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { ReportSequence } from './report-sequence.entity';
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
export class DefectReportsService implements OnModuleInit {
  constructor(
    @InjectRepository(DefectReport) private reportsRepo: Repository<DefectReport>,
    @InjectRepository(InspectionDetail) private inspectionRepo: Repository<InspectionDetail>,
    @InjectRepository(SmReview) private smReviewRepo: Repository<SmReview>,
    @InjectRepository(GmApproval) private gmApprovalRepo: Repository<GmApproval>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private events: EventEmitter2,
    private imageUploadService: ImageUploadService,
  ) {}

  async onModuleInit() {
    const reports = await this.reportsRepo.find({ order: { createdAt: 'ASC' } });
    for (const report of reports) {
      if (!report.reportNumber || !report.reportNumber.startsWith('AGIPL')) {
        report.reportNumber = await this.generateReportNumber();
        await this.reportsRepo.save(report);
      }
    }
  }

  private async generateReportNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return await this.reportsRepo.manager.transaction(async (manager) => {
      let seq = await manager.findOne(ReportSequence, { where: { id: 'AGIPL' } });
      if (!seq) {
        seq = manager.create(ReportSequence, { id: 'AGIPL', lastValue: 0 });
      }
      seq.lastValue += 1;
      await manager.save(seq);
      return `AGIPL-${year}-ERR-${String(seq.lastValue).padStart(5, '0')}`;
    });
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
    // Wrapped in try-catch so notification/email failures never crash report operations
    try {
      this.events.emit('report.status.changed', {
        reportId: report.id,
        reportNumber: report.reportNumber,
        status: report.status,
      });
    } catch (error: any) {
      console.error(
        `[NOTIFICATION_ERROR] Failed to emit status change for report ${report.reportNumber}: ${error.message}. ` +
        `Report status was updated successfully. Email/notification delivery will be retried.`
      );
    }
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
          report,
          inspectorId: actor.id,
          errorType: dto.inlineInspection.errorType,
          rootCause: dto.inlineInspection.rootCause,
          responsibleParty: dto.inlineInspection.responsibleParty as any,
          responsibleId: dto.inlineInspection.responsibleId,
          decision: dto.inlineInspection.decision as any,
          alternativeNote: dto.inlineInspection.alternativeNote,
          costEstimate: dto.inlineInspection.costEstimate,
          timeEstimateHours: dto.inlineInspection.timeEstimateHours,
          lossAmount: dto.inlineInspection.lossAmount,
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
          report,
          inspectorId: actor.id, // SM stands in for inspection step
          errorType: dto.inlineInspection.errorType,
          rootCause: dto.inlineInspection.rootCause,
          responsibleParty: dto.inlineInspection.responsibleParty as any,
          responsibleId: dto.inlineInspection.responsibleId,
          decision: dto.inlineInspection.decision as any,
          alternativeNote: dto.inlineInspection.alternativeNote,
          costEstimate: dto.inlineInspection.costEstimate,
          timeEstimateHours: dto.inlineInspection.timeEstimateHours,
          lossAmount: dto.inlineInspection.lossAmount,
        }),
      );
      await this.smReviewRepo.save(
        this.smReviewRepo.create({
          report,
          smId: actor.id,
          loopholeNote: dto.inlineSmReview.loopholeNote,
          decisionNote: dto.inlineSmReview.decisionNote,
          biasedFlag: dto.inlineSmReview.biasedFlag ?? false,
          forwardedToGm: true,
        }),
      );
    }

    await this.logStatusChange(report.id, actor, ReportStatus.DRAFT, report.status, 'Report raised');
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 1] Report Created: ${report.reportNumber} (ID: ${report.id}, Status: ${report.status})`);
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 2] Event Emitted: report.status.changed for status ${report.status}`);
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
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues', 'auditLogs', 'auditLogs.actor'],
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
      relations: ['raisedBy', 'auditLogs', 'auditLogs.actor'],
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

    let inspection = await this.inspectionRepo.findOne({
      where: { reportId: report.id },
      relations: ['report'],
    });
    if (!inspection) {
      inspection = this.inspectionRepo.create({ report });
    } else {
      inspection.report = report;
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

    let smReview = await this.smReviewRepo.findOne({
      where: { reportId: report.id },
      relations: ['report'],
    });
    if (!smReview) {
      smReview = this.smReviewRepo.create({ report });
    } else {
      smReview.report = report;
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
      const newLogs: AuditLog[] = [];
      for (const field of inspectFields) {
        if (dto[field] !== (report.inspectionDetail as any)[field] && dto[field] !== undefined) {
          const log = await this.auditRepo.save(
            this.auditRepo.create({
              reportId: report.id,
              actorId: actor.id,
              actorRole: actor.role,
              actionType: AuditActionType.FIELD_EDIT,
              fieldName: field,
              oldValue: String((report.inspectionDetail as any)[field]),
              newValue: String(dto[field]),
              note: `Senior Manager edited ${field} during review`,
            })
          );
          newLogs.push(log);
          (report.inspectionDetail as any)[field] = dto[field];
          changed = true;
        }
      }
      if (changed) {
        await this.inspectionRepo.save(report.inspectionDetail);
      }
      if (report.auditLogs) {
        report.auditLogs.push(...newLogs);
      }
    }

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

    let gmApproval = await this.gmApprovalRepo.findOne({
      where: { reportId: report.id },
      relations: ['report'],
    });
    if (!gmApproval) {
      gmApproval = this.gmApprovalRepo.create({ report });
    } else {
      gmApproval.report = report;
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

    const inspectFields = ['costEstimate', 'timeEstimateHours', 'lossAmount'];
    let oldValue: any;
    
    if (inspectFields.includes(field)) {
      if (report.inspectionDetail) {
        oldValue = (report.inspectionDetail as any)[field];
        (report.inspectionDetail as any)[field] = Number(newValue);
        await this.inspectionRepo.save(report.inspectionDetail);
      }
    } else {
      oldValue = (report as any)[field];
      if (field in report) {
        (report as any)[field] = newValue;
        await this.reportsRepo.save(report);
      }
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

  async issueComponents(reportId: string, dto: { remarks: string }, actor: ActingUser) {
    const report = await this.findOne(reportId);
    
    if (report.status !== ReportStatus.APPROVED) {
      throw new BadRequestException('Report must be APPROVED before components can be issued.');
    }
    
    if (report.componentsIssued) {
      throw new BadRequestException('Components have already been issued for this report.');
    }

    const from = report.status;
    report.componentsIssued = true;
    report.componentsIssuedById = actor.id;
    report.componentsIssuedAt = new Date();
    report.issueRemarks = dto.remarks || '';
    report.status = ReportStatus.COMPONENTS_ISSUED;
    
    await this.reportsRepo.save(report);
    
    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: report.id,
        actorId: actor.id,
        actorRole: actor.role,
        actionType: AuditActionType.COMPONENT_ISSUED,
        fromStatus: from,
        toStatus: report.status,
        note: dto.remarks || 'Components were issued by the Store Manager.',
      }),
    );
    
    this.emitStatusChange(report);
    
    return report;
  }
}
