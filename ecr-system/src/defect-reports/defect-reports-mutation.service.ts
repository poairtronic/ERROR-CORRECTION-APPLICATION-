import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { AuditLog } from '../audit-log/audit-log.entity';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { calculateTotalCost } from './utils/cost-calculator';
import { ActingUser } from './defect-reports.types';

@Injectable()
export class DefectReportsMutationService {
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
    private readonly workflowService: DefectReportsWorkflowService,
  ) {}

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

  private mapRoleToRaisedBy(role: Role): RaisedByRole {
    if (role === Role.OPERATOR) return RaisedByRole.OPERATOR;
    if (role === Role.INSPECTOR) return RaisedByRole.INSPECTOR;
    if (role === Role.SENIOR_MANAGER) return RaisedByRole.SENIOR_MANAGER;
    throw new BadRequestException('This role cannot raise a defect report');
  }

  async create(dto: CreateDefectReportDto, actor: ActingUser) {
    const raisedByRole = this.mapRoleToRaisedBy(actor.role);
    const isRejection = dto.inspectionType === 'REJECTION';

    const dupWhere: any[] = [
      {
        scOrPoNo: dto.scNo && dto.poNo ? `${dto.scNo} / ${dto.poNo}` : (dto.scOrPoNo || ''),
        stageOfFailure: dto.stageOfFailure,
        raisedById: actor.id,
      },
    ];
    if (dto.scNo && dto.poNo) {
      dupWhere.push({
        scNo: dto.scNo,
        poNo: dto.poNo,
        stageOfFailure: dto.stageOfFailure,
        raisedById: actor.id,
      });
    }
    const recentReport = await this.reportsRepo.findOne({
      where: dupWhere,
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

      if (dto.isDraft) {
        report.status = ReportStatus.DRAFT;
        await reportsRepo.save(report);
        if (dto.inlineInspection) {
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
              timeEstimateHours: dto.inlineInspection.timeEstimateHours ?? null,
              lossAmount: dto.inlineInspection.lossAmount,
              reworkDescription: dto.inlineInspection.reworkDescription,
              rejectionProcessTemplate: dto.rejectionProcessTemplate || dto.inlineInspection?.rejectionProcessTemplate,
              rejectionFailedStage: dto.rejectionFailedStage || dto.inlineInspection?.rejectionFailedStage,
              rejectionStageCosts: dto.rejectionStageCosts || dto.inlineInspection?.rejectionStageCosts,
              rejectionDescription: dto.rejectionDescription || dto.inlineInspection?.rejectionDescription,
            }),
          );
        }
      } else {
        if (raisedByRole === RaisedByRole.OPERATOR) {
          report.status = ReportStatus.PENDING_INSPECTION;
          await reportsRepo.save(report);
        } else if (raisedByRole === RaisedByRole.INSPECTOR) {
          if (!dto.inlineInspection) {
            throw new BadRequestException(
              'inlineInspection is required when Inspector raises a report',
            );
          }
          report.status = ReportStatus.PENDING_ACCOUNTS_REVIEW;
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
              timeEstimateHours: dto.inlineInspection.timeEstimateHours ?? null,
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
              inspectorId: actor.id,
              errorType: dto.inlineInspection.errorType || (isRejection ? 'Rejection' : 'Rework'),
              rootCause: dto.inlineInspection.rootCause || (isRejection ? 'Rejection' : 'Rework'),
              responsibleParty: dto.inlineInspection.responsibleParty as any,
              responsibleId: dto.inlineInspection.responsibleId,
              decision: (dto.inlineInspection.decision || (isRejection ? 'SCRAP' : 'REWORK')) as any,
              alternativeNote: dto.inlineInspection.alternativeNote,
              costEstimate: dto.inlineInspection.costEstimate,
              timeEstimateHours: dto.inlineInspection.timeEstimateHours ?? null,
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
      }

      await this.workflowService.logStatusChange(report.id, actor, ReportStatus.DRAFT, report.status, 'Report raised', manager);
      
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 1] Report Created: ${report.reportNumber} (ID: ${report.id}, Status: ${report.status})`);
      console.log(`[EMAIL_DIAGNOSTICS] [STEP 2] Event Emitted: report.status.changed for status ${report.status}`);
      this.workflowService.emitStatusChange(report, ReportStatus.DRAFT, actor, 'Report raised', 'Report raised');
      return report;
    });
  }

  async update(id: string, dto: CreateDefectReportDto, actor: ActingUser) {
    const raisedByRole = this.mapRoleToRaisedBy(actor.role);
    const isRejection = dto.inspectionType === 'REJECTION';

    return this.reportsRepo.manager.transaction(async (manager) => {
      const reportsRepo = manager.getRepository(DefectReport);
      const inspectionRepo = manager.getRepository(InspectionDetail);

      const report = await reportsRepo.findOne({
        where: { id },
        relations: ['inspectionDetail'],
        relationLoadStrategy: 'query',
        lock: { mode: 'pessimistic_write' },
      });
      if (!report) throw new NotFoundException('Defect report not found');
      if (report.status !== ReportStatus.DRAFT) {
        throw new BadRequestException('Only draft reports can be updated');
      }
      
      if (report.raisedById !== actor.id && actor.role !== Role.GENERAL_MANAGER && actor.role !== Role.SENIOR_MANAGER) {
        throw new ForbiddenException('You do not have permission to edit this draft report');
      }

      report.scOrPoNo = dto.scNo && dto.poNo ? `${dto.scNo} / ${dto.poNo}` : (dto.scOrPoNo || report.scOrPoNo);
      report.scNo = dto.scNo ?? report.scNo;
      report.poNo = dto.poNo ?? report.poNo;
      report.reworkDescription = dto.reworkDescription ?? report.reworkDescription;
      report.rejectionProcessTemplate = dto.rejectionProcessTemplate ?? report.rejectionProcessTemplate;
      report.rejectionFailedStage = dto.rejectionFailedStage ?? report.rejectionFailedStage;
      report.rejectionStageCosts = dto.rejectionStageCosts ?? report.rejectionStageCosts;
      report.rejectionDescription = dto.rejectionDescription ?? report.rejectionDescription;
      report.productId = dto.productId ?? report.productId;
      report.componentName = dto.componentId ?? report.componentName;
      report.errorTypeName = dto.errorTypeId || (dto.inlineInspection?.errorType || report.errorTypeName || (isRejection ? 'Rejection' : 'Rework'));
      report.partNumber = dto.partNumber ?? report.partNumber;
      report.batchNumber = dto.batchNumber ?? report.batchNumber;
      report.quantity = dto.quantity ?? report.quantity;
      report.stageOfFailure = dto.stageOfFailure ?? report.stageOfFailure;
      report.defectDescription = dto.defectDescription ?? report.defectDescription;
      if (dto.images) {
        report.images = dto.images;
      }
      report.inspectionType = dto.inspectionType ?? report.inspectionType;

      const oldStatus = report.status;
      if (dto.isDraft === false) {
        if (raisedByRole === RaisedByRole.OPERATOR) {
          report.status = ReportStatus.PENDING_INSPECTION;
        } else if (raisedByRole === RaisedByRole.INSPECTOR) {
          if (!dto.inlineInspection) {
            throw new BadRequestException('inlineInspection is required to submit report');
          }
          report.status = ReportStatus.PENDING_ACCOUNTS_REVIEW;
        } else if (raisedByRole === RaisedByRole.SENIOR_MANAGER) {
          if (!dto.inlineInspection || !dto.inlineSmReview) {
            throw new BadRequestException('inlineInspection and inlineSmReview are required to submit report');
          }
          report.status = ReportStatus.PENDING_GM_APPROVAL;
        }
      }

      await reportsRepo.save(report);

      if (dto.inlineInspection) {
        let insp = report.inspectionDetail;
        if (!insp) {
          insp = inspectionRepo.create({ report });
        }
        insp.errorType = dto.inlineInspection.errorType || insp.errorType || (isRejection ? 'Rejection' : 'Rework');
        insp.rootCause = dto.inlineInspection.rootCause || insp.rootCause || (isRejection ? 'Rejection' : 'Rework');
        insp.responsibleParty = (dto.inlineInspection.responsibleParty || insp.responsibleParty) as any;
        insp.responsibleId = dto.inlineInspection.responsibleId ?? insp.responsibleId;
        insp.decision = (dto.inlineInspection.decision || insp.decision || (isRejection ? 'SCRAP' : 'REWORK')) as any;
        insp.alternativeNote = dto.inlineInspection.alternativeNote ?? insp.alternativeNote;
        insp.costEstimate = dto.inlineInspection.costEstimate ?? insp.costEstimate;
        insp.timeEstimateHours = dto.inlineInspection.timeEstimateHours !== undefined ? dto.inlineInspection.timeEstimateHours : insp.timeEstimateHours;
        insp.lossAmount = dto.inlineInspection.lossAmount ?? insp.lossAmount;
        insp.reworkDescription = dto.inlineInspection.reworkDescription ?? insp.reworkDescription;
        insp.rejectionProcessTemplate = dto.rejectionProcessTemplate || dto.inlineInspection?.rejectionProcessTemplate || insp.rejectionProcessTemplate;
        insp.rejectionFailedStage = dto.rejectionFailedStage || dto.inlineInspection?.rejectionFailedStage || insp.rejectionFailedStage;
        insp.rejectionStageCosts = dto.rejectionStageCosts || dto.inlineInspection?.rejectionStageCosts || insp.rejectionStageCosts;
        insp.rejectionDescription = dto.rejectionDescription || dto.inlineInspection?.rejectionDescription || insp.rejectionDescription;
        
        report.inspectionDetail = insp;
        insp.costEstimate = calculateTotalCost(report);
        
        await inspectionRepo.save(insp);
      }

      if (dto.isDraft === false) {
        await this.workflowService.logStatusChange(report.id, actor, oldStatus, report.status, 'Report submitted from draft', manager);
        this.workflowService.emitStatusChange(report, oldStatus, actor, 'Report submitted from draft');
      }

      return report;
    });
  }
}
