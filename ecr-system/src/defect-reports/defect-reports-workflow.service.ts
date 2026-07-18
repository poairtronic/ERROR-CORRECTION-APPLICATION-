import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import { ReportStatus, RaisedByRole, ResponsibleParty } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { ActingUser } from './defect-reports.types';
import { calculateTotalCost } from './utils/cost-calculator';

@Injectable()
export class DefectReportsWorkflowService {
  private readonly logger = new Logger(DefectReportsWorkflowService.name);

  constructor(
    @InjectRepository(DefectReport)
    private readonly reportsRepo: Repository<DefectReport>,
    @InjectRepository(InspectionDetail)
    private readonly inspectionRepo: Repository<InspectionDetail>,
    @InjectRepository(SmReview)
    private readonly smReviewRepo: Repository<SmReview>,
    @InjectRepository(GmApproval)
    private readonly gmApprovalRepo: Repository<GmApproval>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly events: EventEmitter2,
  ) {}

  public async logStatusChange(
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

  public emitStatusChange(
    report: DefectReport,
    fromStatus?: ReportStatus,
    actor?: ActingUser,
    actionTaken?: string,
    comments?: string,
    messageToSm?: string,
  ) {
    try {
      this.events.emit('report.status.changed', {
        reportId: report.id,
        reportNumber: report.reportNumber,
        status: report.status,
        fromStatus,
        actor,
        actionTaken,
        comments,
        messageToSm,
      });
    } catch (error: any) {
      console.error(
        `[NOTIFICATION_ERROR] Failed to emit status change for report ${report.reportNumber}: ${error.message}. ` +
        `Report status was updated successfully. Email/notification delivery will be retried.`
      );
    }
  }

  async inspect(reportId: string, dto: InspectReportDto, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const inspectionRepo = manager.getRepository(InspectionDetail);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
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
        timeEstimateHours: dto.timeEstimateHours,
        lossAmount: dto.lossAmount,
        reworkDescription: dto.reworkDescription,
        rejectionProcessTemplate: dto.rejectionProcessTemplate,
        rejectionFailedStage: dto.rejectionFailedStage,
        rejectionStageCosts: dto.rejectionStageCosts,
        rejectionDescription: dto.rejectionDescription,
      });

      report.inspectionDetail = inspection;
      inspection.costEstimate = dto.costEstimate ?? calculateTotalCost(report);
      await inspectionRepo.save(inspection);

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
      report.status = ReportStatus.PENDING_ACCOUNTS_REVIEW;
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, 'Inspection complete', manager);
      this.emitStatusChange(report, from, actor, 'Inspection complete', 'Inspection complete');
      return report;
    });
  }

  async smReview(reportId: string, dto: SmReviewDto, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const smReviewRepo = manager.getRepository(SmReview);
      const auditRepo = manager.getRepository(AuditLog);
      const inspectionRepo = manager.getRepository(InspectionDetail);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval', 'componentIssues'],
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
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
      this.emitStatusChange(report, from, actor, dto.forwardToGm ? 'Senior Manager Review Approved' : 'Senior Manager Review Rejected', dto.decisionNote);
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
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
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
        messageToSm: dto.messageToSm,
      });
      await gmApprovalRepo.save(gmApproval);
      report.gmApproval = gmApproval;

      const from = report.status;
      report.status = dto.approved ? ReportStatus.APPROVED : ReportStatus.REJECTED;
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, dto.remarks, manager);
      this.emitStatusChange(report, from, actor, dto.approved ? 'General Manager Approved' : 'General Manager Rejected', dto.remarks, dto.messageToSm);

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
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
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
        'componentName',
        'errorTypeName',
      ];

      if (actor.role === Role.SENIOR_MANAGER && !smAllowedFields.includes(field)) {
        throw new BadRequestException('Senior Manager cannot edit this field');
      }

      if (actor.role === Role.GENERAL_MANAGER) {
        const gmAllowedFields = ['costEstimate', 'stageOfFailure', 'rejectionStageCosts', 'lossAmount', 'componentName', 'errorTypeName'];
        if (!gmAllowedFields.includes(field)) {
          throw new BadRequestException('General Manager can only edit costEstimate, stageOfFailure, rejectionStageCosts, lossAmount, componentName, or errorTypeName');
        }
        if (report.status !== ReportStatus.PENDING_GM_APPROVAL) {
          throw new BadRequestException('General Manager can only edit reports pending GM approval');
        }
      }

      if (actor.role === Role.ACCOUNTS) {
        const accountsAllowedFields = ['materialCost', 'labourCost', 'otherCost', 'lossAmount', 'costRemarks', 'costEstimate', 'rejectionStageCosts', 'componentName', 'errorTypeName'];
        if (!accountsAllowedFields.includes(field)) {
          throw new BadRequestException('Accounts can only edit materialCost, labourCost, otherCost, lossAmount, costRemarks, costEstimate, rejectionStageCosts, componentName, or errorTypeName');
        }
        const allowedAccountsStatuses = [
          ReportStatus.PENDING_ACCOUNTS_REVIEW,
        ];
        if (!allowedAccountsStatuses.includes(report.status as any)) {
          throw new BadRequestException('Accounts can only edit reports that are pending accounts review');
        }
      }

      if (
        actor.role !== Role.SENIOR_MANAGER &&
        actor.role !== Role.GENERAL_MANAGER &&
        actor.role !== Role.ACCOUNTS
      ) {
        throw new BadRequestException('Only Senior Manager, General Manager, or Accounts can edit report data');
      }

      if (field === 'status') {
        throw new BadRequestException('Status cannot be manually edited through editField. Use transitionStatus instead.');
      }

      const inspectFields = ['costEstimate', 'timeEstimateHours', 'lossAmount'];
      const accountsFields = ['materialCost', 'labourCost', 'otherCost', 'costRemarks'];
      let oldValue: any;

      let oldCalculatedTotal = 0;
      if (report.inspectionDetail) {
        oldCalculatedTotal = calculateTotalCost(report);
      }

      if (accountsFields.includes(field)) {
        if (report.inspectionDetail) {
          oldValue = (report.inspectionDetail as any)[field];
          if (field === 'costRemarks') {
            report.inspectionDetail.costRemarks = newValue;
          } else {
            (report.inspectionDetail as any)[field] = Number(newValue);
          }
          await inspectionRepo.save(report.inspectionDetail);
        } else {
          throw new BadRequestException('Cannot edit cost because report has not been inspected');
        }
      } else if (inspectFields.includes(field)) {
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
        if (report.inspectionDetail) {
          if (field === 'errorTypeName') {
            report.inspectionDetail.errorType = newValue;
            await inspectionRepo.save(report.inspectionDetail);
          } else if (field in report.inspectionDetail) {
            (report.inspectionDetail as any)[field] = newValue;
            await inspectionRepo.save(report.inspectionDetail);
          }
        }
      }

      const costFields = ['materialCost', 'labourCost', 'otherCost', 'rejectionStageCosts', 'rejectionFailedStage', 'rejectionProcessTemplate'];
      if (costFields.includes(field) && report.inspectionDetail) {
        const newCalculatedTotal = calculateTotalCost(report);
        const diff = newCalculatedTotal - oldCalculatedTotal;
        const currentCostEstimate = Number(report.inspectionDetail.costEstimate || 0);
        report.inspectionDetail.costEstimate = parseFloat((currentCostEstimate + diff).toFixed(2));
        await inspectionRepo.save(report.inspectionDetail);
      }

      await auditRepo.save(
        auditRepo.create({
          reportId: report.id,
          actorId: actor.id,
          actorRole: actor.role,
          actionType: AuditActionType.FIELD_EDIT,
          fieldName: field,
          oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue ?? ''),
          newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue ?? ''),
          note: `Field '${field}' updated by ${actor.role}`,
        }),
      );

      return report;
    });
  }

  async transitionStatus(reportId: string, newStatus: ReportStatus, note: string, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);

      const report = await reportsRepo.findOne({
        where: { id: reportId },
        relations: ['inspectionDetail'],
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
      });
      if (!report) throw new NotFoundException('Defect report not found');
      
      // Workflow State Machine rules
      const validTransitions: Record<ReportStatus, ReportStatus[]> = {
        [ReportStatus.DRAFT]: [ReportStatus.PENDING_INSPECTION, ReportStatus.PENDING_ACCOUNTS_REVIEW, ReportStatus.PENDING_SM_REVIEW, ReportStatus.PENDING_GM_APPROVAL],
        [ReportStatus.PENDING_INSPECTION]: [ReportStatus.PENDING_ACCOUNTS_REVIEW],
        [ReportStatus.PENDING_ACCOUNTS_REVIEW]: [ReportStatus.PENDING_SM_REVIEW],
        [ReportStatus.PENDING_SM_REVIEW]: [ReportStatus.PENDING_GM_APPROVAL, ReportStatus.REJECTED],
        [ReportStatus.PENDING_GM_APPROVAL]: [ReportStatus.APPROVED, ReportStatus.REJECTED],
        [ReportStatus.APPROVED]: [ReportStatus.COMPONENTS_ISSUED, ReportStatus.CLOSED],
        [ReportStatus.COMPONENTS_ISSUED]: [ReportStatus.REWORK_IN_PROGRESS, ReportStatus.NEW_PRODUCTION, ReportStatus.CLOSED],
        [ReportStatus.REWORK_IN_PROGRESS]: [ReportStatus.NEW_PRODUCTION, ReportStatus.CLOSED],
        [ReportStatus.NEW_PRODUCTION]: [ReportStatus.CLOSED],
        [ReportStatus.REJECTED]: [],
        [ReportStatus.CLOSED]: [],
      };

      if (actor.role === Role.ACCOUNTS) {
        if (report.status !== ReportStatus.PENDING_ACCOUNTS_REVIEW || newStatus !== ReportStatus.PENDING_SM_REVIEW) {
          throw new BadRequestException('Accounts can only submit reports pending accounts review to Senior Manager review.');
        }

        const insp = report.inspectionDetail;
        if (!insp) {
          throw new BadRequestException('Inspection details are missing. Cannot proceed to Senior Manager review.');
        }
        if (insp.materialCost == null || insp.labourCost == null || insp.lossAmount == null || insp.costEstimate == null) {
          throw new BadRequestException('materialCost, labourCost, lossAmount, and costEstimate are required before passing to SM.');
        }
      }

      const allowedNext = validTransitions[report.status];
      if (!allowedNext || !allowedNext.includes(newStatus)) {
        throw new BadRequestException(`Invalid transition from ${report.status} to ${newStatus}`);
      }

      const from = report.status;
      report.status = newStatus;
      
      await reportsRepo.save(report);
      await this.logStatusChange(report.id, actor, from, report.status, note || 'Status updated', manager);
      this.emitStatusChange(report, from, actor, 'Status updated', note);
      
      return report;
    });
  }

  async issueComponents(reportId: string, dto: { remarks: string }, actor: ActingUser) {
    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const auditRepo = manager.getRepository(AuditLog);

      const report = await reportsRepo.findOne({ 
        where: { id: reportId },
        lock: { mode: 'pessimistic_write' },
      });
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
      
      this.emitStatusChange(report, from, actor, 'Components Issued', dto.remarks || 'Components were issued by the Store Manager.');
      
      return report;
    });
  }
}
