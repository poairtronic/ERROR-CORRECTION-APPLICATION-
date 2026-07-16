import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ForbiddenException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { ReportSequence } from './report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { DefectReportsImageService } from './defect-reports-image.service';
import { calculateTotalCost } from './utils/cost-calculator';

export interface ActingUser {
  id: string;
  role: Role;
  username?: string;
}

@Injectable()
export class DefectReportsService implements OnModuleInit {
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
    @Inject(forwardRef(() => DefectReportsWorkflowService))
    private readonly workflowService: DefectReportsWorkflowService,
    @Inject(forwardRef(() => DefectReportsImageService))
    private readonly imageService: DefectReportsImageService,
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

  private mapRoleToRaisedBy(role: Role): RaisedByRole {
    if (role === Role.OPERATOR) return RaisedByRole.OPERATOR;
    if (role === Role.INSPECTOR) return RaisedByRole.INSPECTOR;
    if (role === Role.SENIOR_MANAGER) return RaisedByRole.SENIOR_MANAGER;
    throw new BadRequestException('This role cannot raise a defect report');
  }

  async create(dto: CreateDefectReportDto, actor: ActingUser) {
    const raisedByRole = this.mapRoleToRaisedBy(actor.role);
    const isRejection = dto.inspectionType === 'REJECTION';

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

  async findOne(id: string, actor?: any) {
    const report = await this.reportsRepo.findOne({
      where: { id },
      relations: {
        raisedBy: true,
        inspectionDetail: true,
        smReview: true,
        gmApproval: true,
        componentIssues: true,
        auditLogs: { actor: true },
      },
      relationLoadStrategy: 'query',
    });
    if (!report) throw new NotFoundException('Defect report not found');

    if (report.status === ReportStatus.DRAFT) {
      if (!actor || report.raisedById !== actor.id) {
        throw new ForbiddenException('You do not have permission to access this draft report');
      }
    }

    if (actor && actor.role === 'OPERATOR') {
      const isCreator = report.raisedById === actor.id;
      const isAssigned = report.inspectionDetail?.responsibleId === actor.id;
      if (!isCreator && !isAssigned) {
        throw new ForbiddenException('You do not have permission to access this report');
      }
    }

    return report;
  }

  async findAll(filters: { status?: string; raisedById?: string; page?: number; limit?: number }, actor?: any) {
    const where: any = {};
    if (filters.status) {
      if (filters.status === ReportStatus.DRAFT) {
        where.status = filters.status;
        where.raisedById = actor?.id || '';
      } else {
        where.status = filters.status;
      }
    } else {
      where.status = Not(ReportStatus.DRAFT);
    }

    if (filters.raisedById) {
      where.raisedById = filters.raisedById;
    }

    const limit = filters.limit ? Math.min(filters.limit, 1000) : 500;
    const page = filters.page || 1;
    const skip = (page - 1) * limit;

    return this.reportsRepo.find({
      where,
      relations: {
        raisedBy: true,
        inspectionDetail: true,
        auditLogs: { actor: true },
      },
      relationLoadStrategy: 'query',
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
  }

  // Delegate Workflow methods
  async inspect(reportId: string, dto: InspectReportDto, actor: ActingUser) {
    return this.workflowService.inspect(reportId, dto, actor);
  }

  async smReview(reportId: string, dto: SmReviewDto, actor: ActingUser) {
    return this.workflowService.smReview(reportId, dto, actor);
  }

  async gmApprove(reportId: string, dto: GmApproveDto, actor: ActingUser) {
    return this.workflowService.gmApprove(reportId, dto, actor);
  }

  async editField(reportId: string, field: string, newValue: string, actor: ActingUser) {
    return this.workflowService.editField(reportId, field, newValue, actor);
  }

  async transitionStatus(reportId: string, newStatus: ReportStatus, note: string, actor: ActingUser) {
    return this.workflowService.transitionStatus(reportId, newStatus, note, actor);
  }

  async issueComponents(reportId: string, dto: { remarks: string }, actor: ActingUser) {
    return this.workflowService.issueComponents(reportId, dto, actor);
  }

  // Delegate Image methods
  async uploadImages(reportId: string, files: Express.Multer.File[], actor: ActingUser) {
    return this.imageService.uploadImages(reportId, files, actor);
  }

  async deleteImage(reportId: string, imageUrl: string, actor: ActingUser) {
    return this.imageService.deleteImage(reportId, imageUrl, actor);
  }
}
