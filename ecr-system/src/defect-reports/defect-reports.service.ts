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
import { Repository, Not, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DefectReport } from './defect-report.entity';
import { ReportSequence } from './report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { SalaryDeduction } from '../salary-deduction/salary-deduction.entity';
import { VendorFaultLog } from '../vendor-fault/vendor-fault-log.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { Notification } from '../notifications/notification.entity';
import { EmailLog } from '../email/entities/email-log.entity';
import { EmailMonitoringAuditLog } from '../email-monitoring/entities/email-monitoring-audit-log.entity';
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
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
    @Inject(forwardRef(() => DefectReportsWorkflowService))
    private readonly workflowService: DefectReportsWorkflowService,
    @Inject(forwardRef(() => DefectReportsImageService))
    private readonly imageService: DefectReportsImageService,
    private readonly mutationService: DefectReportsMutationService,
  ) {}

  async onModuleInit() {
    try {
      await this.reportsRepo.query(`ALTER TYPE defect_reports_status_enum ADD VALUE IF NOT EXISTS 'INSPECTOR_DRAFT'`);
      await this.reportsRepo.query(`ALTER TYPE defect_reports_status_enum ADD VALUE IF NOT EXISTS 'ACCOUNTS_DRAFT'`);
      await this.reportsRepo.query(`ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'CUSTOMER'`);
      await this.reportsRepo.query(`ALTER TYPE inspection_details_responsibleparty_enum ADD VALUE IF NOT EXISTS 'MATERIAL'`);
    } catch (err: any) {
      // Ignore if enums already contain values or not supported
    }

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

    return report;
  }

  async findAll(filters: { status?: string; raisedById?: string; page?: number; limit?: number }, actor?: any) {
    const baseWhere: any = {};
    if (filters.status) {
      if (filters.status === ReportStatus.DRAFT) {
        baseWhere.status = filters.status;
        if (actor?.id) {
          baseWhere.raisedById = actor.id;
        }
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

  async hardDelete(id: string, actor?: ActingUser) {
    if (actor && actor.role?.toUpperCase() !== Role.ADMIN) {
      throw new ForbiddenException('Only Administrators are authorized to permanently delete Quality Reports');
    }

    const report = await this.reportsRepo.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException('Quality Report not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Delete SalaryDeduction records
      await queryRunner.manager.delete(SalaryDeduction, { reportId: id });

      // 2. Delete VendorFaultLog records
      await queryRunner.manager.delete(VendorFaultLog, { reportId: id });

      // 3. Delete ComponentIssue records
      await queryRunner.manager.delete(ComponentIssue, { reportId: id });

      // 4. Delete GmApproval record
      await queryRunner.manager.delete(GmApproval, { reportId: id });

      // 5. Delete SmReview record
      await queryRunner.manager.delete(SmReview, { reportId: id });

      // 6. Delete InspectionDetail record
      await queryRunner.manager.delete(InspectionDetail, { reportId: id });

      // 7. Delete AuditLog records
      await queryRunner.manager.delete(AuditLog, { reportId: id });

      // 8. Delete Notification records
      await queryRunner.manager.delete(Notification, { reportId: id });

      // 9. Delete EmailLogs and linked EmailMonitoringAuditLogs
      const emailLogs = await queryRunner.manager.find(EmailLog, { where: { relatedReportId: id } });
      if (emailLogs.length > 0) {
        const emailLogIds = emailLogs.map((e) => e.id);
        await queryRunner.manager.delete(EmailMonitoringAuditLog, { emailLogId: In(emailLogIds) });
        await queryRunner.manager.delete(EmailLog, { id: In(emailLogIds) });
      }

      // 10. Clean up raw table records if any exist
      try {
        await queryRunner.query(`DELETE FROM operational_timeline WHERE report_id = $1`, [id]);
      } catch (_) {}
      try {
        await queryRunner.query(`DELETE FROM production_log WHERE report_id = $1`, [id]);
      } catch (_) {}

      // 11. Permanently delete the parent DefectReport
      await queryRunner.manager.delete(DefectReport, { id });

      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Quality Report deleted successfully.',
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
