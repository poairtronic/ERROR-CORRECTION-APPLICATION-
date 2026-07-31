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
      const tableExists = async (tableName: string) => {
        const res = await queryRunner.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
          [tableName],
        );
        return Array.isArray(res) && res.length > 0;
      };

      const columnExists = async (tableName: string, columnName: string) => {
        const res = await queryRunner.query(
          `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
          [tableName, columnName],
        );
        return Array.isArray(res) && res.length > 0;
      };

      const safeDeleteByCol = async (tableName: string, colName: string, value: string) => {
        if (await tableExists(tableName)) {
          if (await columnExists(tableName, colName)) {
            await queryRunner.query(`DELETE FROM "${tableName}" WHERE "${colName}" = $1`, [value]);
          }
        }
      };

      // 1. Delete SalaryDeduction
      await safeDeleteByCol('salary_deduction', 'report_id', id);

      // 2. Delete VendorFaultLog
      await safeDeleteByCol('vendor_fault_log', 'report_id', id);

      // 3. Delete ComponentIssue
      await safeDeleteByCol('component_issue', 'report_id', id);

      // 4. Delete GmApproval
      await safeDeleteByCol('gm_approval', 'report_id', id);

      // 5. Delete SmReview
      await safeDeleteByCol('sm_review', 'report_id', id);

      // 6. Delete InspectionDetail
      await safeDeleteByCol('inspection_details', 'report_id', id);

      // 7. Delete AuditLog
      await safeDeleteByCol('audit_log', 'report_id', id);

      // 8. Delete Notification
      await safeDeleteByCol('notifications', 'report_id', id);

      // 9. Delete EmailLogs and EmailMonitoringAuditLogs
      if (await tableExists('email_logs')) {
        const emailCol = (await columnExists('email_logs', 'relatedReportId'))
          ? 'relatedReportId'
          : (await columnExists('email_logs', 'related_report_id'))
          ? 'related_report_id'
          : null;

        if (emailCol) {
          const emailRows = await queryRunner.query(
            `SELECT id FROM "email_logs" WHERE "${emailCol}" = $1`,
            [id],
          );
          if (Array.isArray(emailRows) && emailRows.length > 0) {
            const emailIds = emailRows.map((r: any) => r.id);
            if (await tableExists('email_monitoring_audit_logs')) {
              const auditCol = (await columnExists('email_monitoring_audit_logs', 'emailLogId'))
                ? 'emailLogId'
                : (await columnExists('email_monitoring_audit_logs', 'email_log_id'))
                ? 'email_log_id'
                : null;
              if (auditCol) {
                await queryRunner.query(
                  `DELETE FROM "email_monitoring_audit_logs" WHERE "${auditCol}" = ANY($1)`,
                  [emailIds],
                );
              }
            }
            await queryRunner.query(
              `DELETE FROM "email_logs" WHERE "${emailCol}" = $1`,
              [id],
            );
          }
        }
      }

      // 10. Delete from optional tables if present
      await safeDeleteByCol('operational_timeline', 'report_id', id);
      await safeDeleteByCol('production_log', 'report_id', id);

      // 11. Delete parent DefectReport
      await safeDeleteByCol('defect_reports', 'id', id);

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
