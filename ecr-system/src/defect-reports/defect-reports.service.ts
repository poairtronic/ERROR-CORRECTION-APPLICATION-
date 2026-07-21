import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  ForbiddenException,
  Inject,
  forwardRef
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { ReportSequence } from './report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { CreateDefectReportDto } from './dto/create-defect-report.dto';
import { InspectReportDto } from './dto/inspect-report.dto';
import { SmReviewDto } from './dto/sm-review.dto';
import { GmApproveDto } from './dto/gm-approve.dto';
import { ReportStatus, RaisedByRole } from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';
import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { DefectReportsImageService } from './defect-reports-image.service';
import { DefectReportsMutationService } from './defect-reports-mutation.service';
import { ActingUser } from './defect-reports.types';

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
    private readonly mutationService: DefectReportsMutationService,
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

  private async generateReportNumber(): Promise<string> {
    const year = new Date().getFullYear();
    return await this.reportsRepo.manager.transaction(async (mgr) => {
      let seq = await mgr.findOne(ReportSequence, { where: { id: 'AGIPL' } });
      if (!seq) {
        seq = mgr.create(ReportSequence, { id: 'AGIPL', lastValue: 0 });
      }
      seq.lastValue += 1;
      await mgr.save(seq);
      return `AGIPL-${year}-ERR-${String(seq.lastValue).padStart(5, '0')}`;
    });
  }

  async create(dto: CreateDefectReportDto, actor: ActingUser) {
    return this.mutationService.create(dto, actor);
  }

  async update(id: string, dto: CreateDefectReportDto, actor: ActingUser) {
    return this.mutationService.update(id, dto, actor);
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
    const baseWhere: any = {};
    if (filters.status) {
      if (filters.status === ReportStatus.DRAFT) {
        baseWhere.status = filters.status;
        baseWhere.raisedById = actor?.id || '';
      } else {
        baseWhere.status = filters.status;
      }
    } else {
      baseWhere.status = Not(ReportStatus.DRAFT);
    }

    if (filters.raisedById) {
      baseWhere.raisedById = filters.raisedById;
    }

    const limit = filters.limit ? Math.min(filters.limit, 1000) : 500;
    const page = filters.page || 1;
    const skip = (page - 1) * limit;

    if (actor?.role === 'OPERATOR') {
      return this.reportsRepo.find({
        where: [
          { ...baseWhere, raisedById: actor.id },
          { ...baseWhere, inspectionDetail: { responsibleId: actor.id } },
        ],
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

    return this.reportsRepo.find({
      where: baseWhere,
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
