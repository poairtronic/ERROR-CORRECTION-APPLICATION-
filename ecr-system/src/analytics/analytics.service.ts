import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { ReportStatus } from '../common/enums/report-status.enum';
import { ResponsibleParty } from '../common/enums/report-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(DefectReport) private reportsRepo: Repository<DefectReport>,
    @InjectRepository(InspectionDetail) private inspectRepo: Repository<InspectionDetail>,
    @InjectRepository(SmReview) private smRepo: Repository<SmReview>,
    @InjectRepository(GmApproval) private gmRepo: Repository<GmApproval>,
    @InjectRepository(ComponentIssue) private issueRepo: Repository<ComponentIssue>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
  ) {}

  async getExecutiveKpis() {
    // Basic counts
    const totalReports = await this.reportsRepo.count();
    const openReports = await this.reportsRepo.count({
      where: [
        { status: ReportStatus.DRAFT },
        { status: ReportStatus.PENDING_INSPECTION },
        { status: ReportStatus.PENDING_SM_REVIEW },
        { status: ReportStatus.PENDING_GM_APPROVAL },
        { status: ReportStatus.APPROVED },
        { status: ReportStatus.COMPONENTS_ISSUED },
        { status: ReportStatus.REWORK_IN_PROGRESS },
        { status: ReportStatus.NEW_PRODUCTION },
      ],
    });
    const closedReports = await this.reportsRepo.count({ where: { status: ReportStatus.CLOSED } });
    const pendingInspect = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } });
    const pendingSm = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_SM_REVIEW } });
    const pendingGm = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_GM_APPROVAL } });

    // Financial aggregations
    // We can use QueryBuilder to sum costEstimate, lossAmount, etc.
    const costs = await this.smRepo.createQueryBuilder('sm')
      .select('SUM(sm.costEstimate)', 'totalCost')
      .addSelect('SUM(sm.lossAmount)', 'totalLoss')
      .getRawOne();

    const vendorCases = await this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } });

    return {
      totalReports,
      openReports,
      closedReports,
      pendingInspect,
      pendingSm,
      pendingGm,
      totalCost: costs?.totalCost || 0,
      totalLoss: costs?.totalLoss || 0,
      vendorCases,
    };
  }

  async getTrends() {
    // defects grouped by month (SQLite compatible query)
    const trends = await this.reportsRepo.createQueryBuilder('r')
      .select("strftime('%Y-%m', r.createdAt)", 'month')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    return trends;
  }

  async getRootCauses() {
    return this.inspectRepo.createQueryBuilder('i')
      .select('i.rootCause', 'cause')
      .addSelect('COUNT(i.id)', 'count')
      .groupBy('i.rootCause')
      .orderBy('count', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getRuleBasedInsights() {
    const insights: string[] = [];
    const recentVendorDefects = await this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } });
    if (recentVendorDefects > 10) {
      insights.push(`High vendor defect rate: ${recentVendorDefects} defects attributed to vendors.`);
    }

    const { totalCost } = await this.getExecutiveKpis();
    if (totalCost > 10000) {
      insights.push(`Rework costs have exceeded budget thresholds (Total: $${totalCost}).`);
    }

    const open = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } });
    if (open > 5) {
      insights.push(`Inspection bottleneck detected: ${open} reports awaiting inspection.`);
    }

    return insights;
  }

  async getVendorIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .select('i.vendorName', 'vendor')
      .addSelect('COUNT(i.id)', 'defects')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.VENDOR })
      .groupBy('i.vendorName')
      .orderBy('defects', 'DESC')
      .getRawMany();
  }

  async getOperatorIntelligence() {
    return this.reportsRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.raisedBy', 'u')
      .select('u.username', 'operator')
      .addSelect('COUNT(r.id)', 'reportsRaised')
      .groupBy('u.username')
      .orderBy('reportsRaised', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getMachineIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .select('i.machineId', 'machine')
      .addSelect('COUNT(i.id)', 'failures')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.MACHINE })
      .groupBy('i.machineId')
      .orderBy('failures', 'DESC')
      .getRawMany();
  }
}
