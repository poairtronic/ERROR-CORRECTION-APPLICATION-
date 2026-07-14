import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
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
    const reports = await this.reportsRepo.createQueryBuilder('r')
      .where('r.reportNumber IS NULL OR r.reportNumber NOT LIKE :prefix', { prefix: 'AGIPL%' })
      .orderBy('r.createdAt', 'ASC')
      .getMany();

    for (const report of reports) {
      report.reportNumber = await this.generateReportNumber();
      await this.reportsRepo.save(report);
    }
  }

  private async generateReportNumber(manager?: EntityManager): Promise<string> {
    const year = new Date().getFullYear();
    const runInTransaction = async (mgr: EntityManager) => {
      let seq = await mgr.findOne(ReportSequence, { where: { id: 'AGIPL' } });
      if (!seq) {
        seq = mgr.create(ReportSequence, { id: 'AGIPL', lastValue: 0 });
      }
      seq.lastValue += 1;
      await mgr.save(seq);
      return `AGIPL-${year}-ERR-${String(seq.lastValue).padStart(5, '0')}`;
    };

    if (manager) {
      return runInTransaction(manager);
    }
    return await this.reportsRepo.manager.transaction(runInTransaction);
  }

  private async logStatusChange(
    reportId: string,
    actor: ActingUser,
    from: ReportStatus,
    to: ReportStatus,
    note?: string,
    manager?: EntityManager,
  ) {
    const repo = manager ? manager.getRepository(AuditLog) : this.auditRepo;
    await repo.save(
      repo.create({
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
    const isRejection = dto.inspectionType === 'REJECTION';

    // Prevent duplicate reports (Step 9 backend debounce)
    const recentReport = await this.reportsRepo.findOne({
      where: {
        scOrPoNo: dto.scNo && dto.poNo ? `${dto.scNo} / ${dto.poNo}` : (dto.scOrPoNo || ''),
        stageOfFailure: dto.stageOfFailure,
        raisedById: actor.id,
      },
      order: { createdAt: 'DESC' },
    });

    if (recentReport) {
      const diffMs = Date.now() - recentReport.createdAt.getTime();
      if (diffMs < 10000) {
        throw new ConflictException('A similar report was recently created. Please wait before submitting again.');
      }
    }

    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const inspectionRepo = manager.getRepository(InspectionDetail);
      const smReviewRepo = manager.getRepository(SmReview);

      const reportNumber = await this.generateReportNumber(manager);

      const report = reportsRepo.create({
        reportNumber,
        raisedById: actor.id,
        raisedByRole,
        scOrPoNo: dto.scNo && dto.poNo ? `${dto.scNo} / ${dto.poNo}` : (dto.scOrPoNo || ''),
        scNo: dto.scNo,
        poNo: dto.poNo,
        reworkDescription: dto.reworkDescription,
        rejectionProcessTemplate: dto.rejectionProcessTemplate,
        rejectionFailedStage: dto.rejectionFailedStage,
        rejectionStageCosts: dto.rejectionStageCosts,
        rejectionDescription: dto.rejectionDescription,
        productId: dto.productId,
        componentName: dto.componentId,
        errorTypeName: dto.errorTypeId || (dto.inlineInspection?.errorType || (isRejection ? 'Rejection' : 'Rework')),
        partNumber: dto.partNumber,
        batchNumber: dto.batchNumber,
        quantity: dto.quantity,
        stageOfFailure: dto.stageOfFailure,
        defectDescription: dto.defectDescription,
        images: dto.images ?? [],
        status: ReportStatus.PENDING_INSPECTION,
        inspectionType: dto.inspectionType,
      });

      if (raisedByRole === RaisedByRole.OPERATOR) {
        report.status = ReportStatus.PENDING_INSPECTION;
        await reportsRepo.save(report);
      } else if (raisedByRole === RaisedByRole.INSPECTOR) {
        if (!dto.inlineInspection) {
          throw new BadRequestException(
            'inlineInspection is required when Inspector raises a report',
          );
        }
        report.status = ReportStatus.PENDING_SM_REVIEW;
        await reportsRepo.save(report);
        await inspectionRepo.save(
          inspectionRepo.create({
            report,
            inspectorId: actor.id,
            errorType: dto.inlineInspection.errorType || (isRejection ? 'Rejection' : 'Rework'),
            rootCause: dto.inlineInspection.rootCause || (isRejection ? 'Rejection' : 'Rework'),
            responsibleParty: dto.inlineInspection.responsibleParty as any,
            responsibleId: dto.inlineInspection.responsibleId,
            decision: (dto.inlineInspection.decision || (isRejection ? 'SCRAP' : 'REWORK')) as any,
            alternativeNote: dto.inlineInspection.alternativeNote,
            costEstimate: dto.inlineInspection.costEstimate,
            timeEstimateHours: dto.inlineInspection.timeEstimateHours ?? 0,
            lossAmount: dto.inlineInspection.lossAmount,
            reworkDescription: dto.inlineInspection.reworkDescription,
            rejectionProcessTemplate: dto.rejectionProcessTemplate || dto.inlineInspection?.rejectionProcessTemplate,
            rejectionFailedStage: dto.rejectionFailedStage || dto.inlineInspection?.rejectionFailedStage,
            rejectionStageCosts: dto.rejectionStageCosts || dto.inlineInspection?.rejectionStageCosts,
            rejectionDescription: dto.rejectionDescription || dto.inlineInspection?.rejectionDescription,
          }),
        );
      } else if (raisedByRole === RaisedByRole.SENIOR_MANAGER) {
        if (!dto.inlineInspection || !dto.inlineSmReview) {
          throw new BadRequestException(
            'inlineInspection and inlineSmReview are required when Senior Manager raises a report',
          );
        }
        report.status = ReportStatus.PENDING_GM_APPROVAL;
        await reportsRepo.save(report);
        await inspectionRepo.save(
          inspectionRepo.create({
            report,
            inspectorId: actor.id, // SM stands in for inspection step
            errorType: dto.inlineInspection.errorType || (isRejection ? 'Rejection' : 'Rework'),
            rootCause: dto.inlineInspection.rootCause || (isRejection ? 'Rejection' : 'Rework'),
            responsibleParty: dto.inlineInspection.responsibleParty as any,
            responsibleId: dto.inlineInspection.responsibleId,
            decision: (dto.inlineInspection.decision || (isRejection ? 'SCRAP' : 'REWORK')) as any,
            alternativeNote: dto.inlineInspection.alternativeNote,
            costEstimate: dto.inlineInspection.costEstimate,
            timeEstimateHours: dto.inlineInspection.timeEstimateHours ?? 0,
            lossAmount: dto.inlineInspection.lossAmount,
            reworkDescription: dto.inlineInspection.reworkDescription,
            rejectionProcessTemplate: dto.rejectionProcessTemplate || dto.inlineInspection?.rejectionProcessTemplate,
            rejectionFailedStage: dto.rejectionFailedStage || dto.inlineInspection?.rejectionFailedStage,
            rejectionStageCosts: dto.rejectionStageCosts || dto.inlineInspection?.rejectionStageCosts,
            rejectionDescription: dto.rejectionDescription || dto.inlineInspection?.rejectionDescription,
          }),
        );
        await smReviewRepo.save(
          smReviewRepo.create({
            report,
            smId: actor.id,
            loopholeNote: dto.inlineSmReview.loopholeNote,
            decisionNote: dto.inlineSmReview.decisionNote,
            biasedFlag: dto.inlineSmReview.biasedFlag ?? false,
            forwardedToGm: true,
          }),
        );
      }

      await this.logStatusChange(report.id, actor, ReportStatus.DRAFT, report.status, 'Report raised', manager);
      
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 1] Report Created: ${report.reportNumber} (ID: ${report.id}, Status: ${report.status})`);
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 2] Event Emitted: report.status.changed for status ${report.status}`);
      this.emitStatusChange(report);
      return report;
    });
  }

  private mapRoleToRaisedBy(role: Role): RaisedByRole {
    if (role === Role.OPERATOR) return RaisedByRole.OPERATOR;
    if (role === Role.INSPECTOR) return RaisedByRole.INSPECTOR;
    if (role === Role.SENIOR_MANAGER) return RaisedByRole.SENIOR_MANAGER;
    throw new BadRequestException('This role cannot raise a defect report');
  }

  async findOne(id: string, actor?: any) {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues', 'auditLogs', 'auditLogs.actor'],
    });
    if (!report) throw new NotFoundException('Defect report not found');

    if (actor && actor.role === 'OPERATOR') {
      const isCreator = report.raisedById === actor.id;
      const isAssigned = report.inspectionDetail?.responsibleId === actor.id;
      if (!isCreator && !isAssigned) {
        throw new ForbiddenException('You do not have permission to access this report');
      }
    }

    return report;
  }

  findAll(filters: { status?: string; raisedById?: string; page?: number; limit?: number }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.raisedById) where.raisedById = filters.raisedById;

    const findOptions: any = {
      where,
      order: { createdAt: 'DESC' },
      relations: ['raisedBy', 'auditLogs', 'auditLogs.actor'],
    };

    if (filters.page && filters.limit) {
      findOptions.skip = (filters.page - 1) * filters.limit;
      findOptions.take = filters.limit;
    }

    return this.reportsRepo.find(findOptions);
  }

  async inspect(reportId: string, dto: InspectReportDto, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const inspectionRepo = manager.getRepository(InspectionDetail);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
      });
      if (!report) throw new NotFoundException('Defect report not found');

      if (report.status !== ReportStatus.PENDING_INSPECTION) {
        throw new BadRequestException('Report is not pending inspection');
      }
      if (report.raisedById === actor.id) {
        throw new BadRequestException('Cannot inspect a report you raised yourself');
      }

      let inspection = await inspectionRepo.findOne({
        where: { reportId: report.id },
        relations: ['report'],
      });
      if (!inspection) {
        inspection = inspectionRepo.create({ report, reportId: report.id });
      } else {
        inspection.report = report;
        inspection.reportId = report.id;
      }
      const isRejection = dto.inspectionType === 'REJECTION' || report.inspectionType === 'REJECTION';
      Object.assign(inspection, {
        inspectorId: actor.id,
        errorType: dto.errorType || (isRejection ? 'Rejection' : 'Rework'),
        rootCause: dto.rootCause || (isRejection ? 'Rejection' : 'Rework'),
        responsibleParty: dto.responsibleParty,
        responsibleId: dto.responsibleId,
        decision: dto.decision || (isRejection ? 'SCRAP' : 'REWORK'),
        alternativeNote: dto.alternativeNote,
        costEstimate: dto.costEstimate,
        timeEstimateHours: dto.timeEstimateHours ?? 0,
        lossAmount: dto.lossAmount,
        reworkDescription: dto.reworkDescription,
        rejectionProcessTemplate: dto.rejectionProcessTemplate,
        rejectionFailedStage: dto.rejectionFailedStage,
        rejectionStageCosts: dto.rejectionStageCosts,
        rejectionDescription: dto.rejectionDescription,
      });
      await inspectionRepo.save(inspection);
      report.inspectionDetail = inspection;

      // Persist the inspection type (REWORK / REJECTION) if provided
      if (dto.inspectionType) {
        report.inspectionType = dto.inspectionType;
      }

      if (isRejection) {
        report.rejectionProcessTemplate = dto.rejectionProcessTemplate;
        report.rejectionFailedStage = dto.rejectionFailedStage;
        report.rejectionStageCosts = dto.rejectionStageCosts;
        report.rejectionDescription = dto.rejectionDescription;
      }

      const from = report.status;
      report.status = ReportStatus.PENDING_SM_REVIEW;
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, 'Inspection complete', manager);
      this.emitStatusChange(report);
      return report;
    });
  }

  /** Senior Manager reviews. Cannot review own-raised report (self-raised SM reports skip this stage entirely). */
  async smReview(reportId: string, dto: SmReviewDto, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const smReviewRepo = manager.getRepository(SmReview);
      const auditRepo = manager.getRepository(AuditLog);
      const inspectionRepo = manager.getRepository(InspectionDetail);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
      });
      if (!report) throw new NotFoundException('Defect report not found');

      if (report.status !== ReportStatus.PENDING_SM_REVIEW) {
        throw new BadRequestException('Report is not pending SM review');
      }
      if (report.raisedById === actor.id) {
        throw new BadRequestException('Cannot review a report you raised yourself');
      }

      let smReview = await smReviewRepo.findOne({
        where: { reportId: report.id },
        relations: ['report'],
      });
      if (!smReview) {
        smReview = smReviewRepo.create({ report, reportId: report.id });
      } else {
        smReview.report = report;
        smReview.reportId = report.id;
      }
      Object.assign(smReview, {
        smId: actor.id,
        loopholeNote: dto.loopholeNote,
        decisionNote: dto.decisionNote,
        biasedFlag: dto.biasedFlag ?? false,
        forwardedToGm: dto.forwardToGm,
      });
      await smReviewRepo.save(smReview);
      report.smReview = smReview;

      if (report.inspectionDetail) {
        const numericFields = ['costEstimate', 'timeEstimateHours', 'lossAmount'];
        let changed = false;
        const newLogs: any[] = [];

        for (const field of numericFields) {
          if (dto[field] !== undefined) {
            const oldVal = (report.inspectionDetail as any)[field];
            const newVal = dto[field];
            const oldNum = oldVal != null ? Number(oldVal) : null;
            const newNum = newVal != null ? Number(newVal) : null;
            if (oldNum !== newNum) {
              const log = auditRepo.create({
                reportId: report.id,
                actorId: actor.id,
                actorRole: actor.role,
                actionType: AuditActionType.FIELD_EDIT,
                fieldName: field,
                oldValue: String(oldVal ?? ''),
                newValue: String(newVal ?? ''),
                note: `Senior Manager edited ${field} during review`,
              });
              await auditRepo.save(log);
              newLogs.push(log);
              (report.inspectionDetail as any)[field] = newVal;
              changed = true;
            }
          }
        }

        if (dto.rejectionStageCosts !== undefined) {
          const oldVal = report.inspectionDetail.rejectionStageCosts;
          const newVal = dto.rejectionStageCosts;
          const oldStr = oldVal != null ? JSON.stringify(oldVal) : '';
          const newStr = newVal != null ? JSON.stringify(newVal) : '';
          if (oldStr !== newStr) {
            const log = auditRepo.create({
              reportId: report.id,
              actorId: actor.id,
              actorRole: actor.role,
              actionType: AuditActionType.FIELD_EDIT,
              fieldName: 'rejectionStageCosts',
              oldValue: oldStr,
              newValue: newStr,
              note: `Senior Manager edited rejectionStageCosts during review`,
            });
            await auditRepo.save(log);
            newLogs.push(log);
            report.inspectionDetail.rejectionStageCosts = newVal;
            report.rejectionStageCosts = newVal;
            changed = true;
          }
        }

        if (changed) {
          await inspectionRepo.save(report.inspectionDetail);
        }
      }

      const from = report.status;
      report.status = dto.forwardToGm ? ReportStatus.PENDING_GM_APPROVAL : ReportStatus.REJECTED;
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, dto.decisionNote, manager);
      this.emitStatusChange(report);
      return report;
    });
  }

  async gmApprove(reportId: string, dto: GmApproveDto, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const gmApprovalRepo = manager.getRepository(GmApproval);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
      });
      if (!report) throw new NotFoundException('Defect report not found');

      if (report.status !== ReportStatus.PENDING_GM_APPROVAL) {
        throw new BadRequestException('Report is not pending GM approval');
      }

      let gmApproval = await gmApprovalRepo.findOne({
        where: { reportId: report.id },
        relations: ['report'],
      });
      if (!gmApproval) {
        gmApproval = gmApprovalRepo.create({ report, reportId: report.id });
      } else {
        gmApproval.report = report;
        gmApproval.reportId = report.id;
      }
      Object.assign(gmApproval, {
        gmId: actor.id,
        approved: dto.approved,
        remarks: dto.remarks,
        budgetApproved: dto.budgetApproved,
      });
      await gmApprovalRepo.save(gmApproval);
      report.gmApproval = gmApproval;

      const from = report.status;
      report.status = dto.approved ? ReportStatus.APPROVED : ReportStatus.REJECTED;
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, dto.remarks, manager);
      this.emitStatusChange(report);

      if (dto.approved && report.inspectionDetail) {
        if (report.inspectionDetail.responsibleParty === ResponsibleParty.OPERATOR) {
          this.events.emit('report.approved.operator_fault', { report, gmId: actor.id });
        } else if (report.inspectionDetail.responsibleParty === ResponsibleParty.VENDOR) {
          this.events.emit('report.approved.vendor_fault', { report, gmId: actor.id });
        }
      }

      return report;
    });
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
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const inspectionRepo = manager.getRepository(InspectionDetail);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
      });
      if (!report) throw new NotFoundException('Defect report not found');

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
        'rejectionStageCosts',
      ];

      if (actor.role === Role.SENIOR_MANAGER && !smAllowedFields.includes(field)) {
        throw new BadRequestException('Senior Manager cannot edit this field');
      }

      if (actor.role === Role.GENERAL_MANAGER) {
        const gmAllowedFields = ['costEstimate', 'stageOfFailure', 'rejectionStageCosts', 'lossAmount'];
        if (!gmAllowedFields.includes(field)) {
          throw new BadRequestException('General Manager can only edit costEstimate, stageOfFailure, rejectionStageCosts, or lossAmount');
        }
        if (report.status !== ReportStatus.PENDING_GM_APPROVAL) {
          throw new BadRequestException('General Manager can only edit reports pending GM approval');
        }
      }

      if (actor.role === Role.SALES) {
        const salesAllowedFields = ['costEstimate', 'lossAmount', 'salesDescription', 'rejectionStageCosts'];
        if (!salesAllowedFields.includes(field)) {
          throw new BadRequestException('Sales can only edit costEstimate, lossAmount, salesDescription, or rejectionStageCosts');
        }
        const allowedSalesStatuses = [
          ReportStatus.APPROVED,
          ReportStatus.COMPONENTS_ISSUED,
          ReportStatus.REWORK_IN_PROGRESS,
          ReportStatus.NEW_PRODUCTION,
          ReportStatus.CLOSED,
        ];
        if (!allowedSalesStatuses.includes(report.status as any)) {
          throw new BadRequestException('Sales can only edit reports that are approved or beyond');
        }
      }

      if (
        actor.role !== Role.SENIOR_MANAGER &&
        actor.role !== Role.GENERAL_MANAGER &&
        actor.role !== Role.SALES
      ) {
        throw new BadRequestException('Only Senior Manager, General Manager, or Sales can edit report data');
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
          await inspectionRepo.save(report.inspectionDetail);
        } else {
          throw new BadRequestException('Cannot edit cost or loss because report has not been inspected');
        }
      } else if (field === 'rejectionStageCosts') {
        oldValue = report.rejectionStageCosts;
        const parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
        report.rejectionStageCosts = parsed;
        await reportsRepo.save(report);

        if (report.inspectionDetail) {
          report.inspectionDetail.rejectionStageCosts = parsed;
          await inspectionRepo.save(report.inspectionDetail);
        }
      } else {
        oldValue = (report as any)[field];
        if (field in report) {
          (report as any)[field] = newValue;
          await reportsRepo.save(report);
        }
        if (report.inspectionDetail && field in report.inspectionDetail) {
          (report.inspectionDetail as any)[field] = newValue;
          await inspectionRepo.save(report.inspectionDetail);
        }
      }

      await auditRepo.save(
        auditRepo.create({
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
    });
  }

  async uploadImages(reportId: string, files: Express.Multer.File[], actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ where: { id: reportId } });
      if (!report) throw new NotFoundException('Defect report not found');
      
      // Upload files to Cloudinary
      const urls = await this.imageUploadService.uploadMultipleImages(files);
      
      const oldImages = [...report.images];
      report.images.push(...urls);
      
      await reportsRepo.save(report);
      
      await auditRepo.save(
        auditRepo.create({
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
    });
  }

  async deleteImage(reportId: string, imageUrl: string, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ where: { id: reportId } });
      if (!report) throw new NotFoundException('Defect report not found');
      
      if (!report.images.includes(imageUrl)) {
        throw new BadRequestException('Image not found in report');
      }
      
      // Delete from Cloudinary
      await this.imageUploadService.deleteImage(imageUrl);
      
      const oldImages = [...report.images];
      report.images = report.images.filter(img => img !== imageUrl);
      
      await reportsRepo.save(report);
      
      await auditRepo.save(
        auditRepo.create({
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
    });
  }

  async transitionStatus(reportId: string, newStatus: ReportStatus, note: string, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);

      const report = await reportsRepo.findOne({ where: { id: reportId } });
      if (!report) throw new NotFoundException('Defect report not found');
      
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
      
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, note || 'Status transitioned manually', manager);
      this.emitStatusChange(report);
      
      return report;
    });
  }

  async issueComponents(reportId: string, dto: { remarks: string }, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ where: { id: reportId } });
      if (!report) throw new NotFoundException('Defect report not found');
      
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
      
      await reportsRepo.save(report);
      
      await auditRepo.save(
        auditRepo.create({
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
    });
  }
}
