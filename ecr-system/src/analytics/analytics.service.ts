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
    const pendingStore = await this.reportsRepo.count({ where: { status: ReportStatus.APPROVED, componentsIssued: false } });

    // Financial aggregations
    // We can use QueryBuilder to sum costEstimate, lossAmount, etc.
    const costs = await this.inspectRepo.createQueryBuilder('i')
      .select('SUM(i.costEstimate)', 'totalCost')
      .addSelect('SUM(i.lossAmount)', 'totalLoss')
      .getRawOne();

    const vendorCases = await this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } });

    return {
      totalReports,
      openReports,
      closedReports,
      pendingInspect,
      pendingSm,
      pendingGm,
      pendingStore,
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
      .leftJoin('vendors', 'v', 'v.id = i.responsibleId')
      .select('v.name', 'vendor')
      .addSelect('COUNT(i.id)', 'defects')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.VENDOR })
      .groupBy('v.name')
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
      .leftJoin('components', 'c', 'c.id = i.responsibleId')
      .select('c.name', 'machine')
      .addSelect('COUNT(i.id)', 'failures')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.MACHINE })
      .groupBy('c.name')
      .orderBy('failures', 'DESC')
      .getRawMany();
  }

  async getSlaMetrics() {
    // Average resolution time in days (SQLite syntax)
    const result = await this.reportsRepo.createQueryBuilder('r')
      .select('AVG(julianday(r.updatedAt) - julianday(r.createdAt))', 'avgResolutionDays')
      .where('r.status = :status', { status: ReportStatus.CLOSED })
      .getRawOne();

    const pendingInspect = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } });
    const pendingSm = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_SM_REVIEW } });
    const pendingGm = await this.reportsRepo.count({ where: { status: ReportStatus.PENDING_GM_APPROVAL } });
    const pendingStore = await this.reportsRepo.count({ where: { status: ReportStatus.APPROVED, componentsIssued: false } });

    return {
      averageResolutionDays: result?.avgResolutionDays ? parseFloat(result.avgResolutionDays).toFixed(1) : 0,
      inspectionQueue: pendingInspect,
      smQueue: pendingSm,
      gmQueue: pendingGm,
      storeQueue: pendingStore
    };
  }

  async getQualityHealthScore() {
    let score = 100;
    
    // Penalize for high open report volume
    const openCount = await this.reportsRepo.count({
      where: [
        { status: ReportStatus.PENDING_INSPECTION },
        { status: ReportStatus.PENDING_SM_REVIEW },
        { status: ReportStatus.PENDING_GM_APPROVAL },
        { status: ReportStatus.APPROVED, componentsIssued: false }
      ]
    });
    score -= (openCount * 2); // -2 points per open report

    // Penalize for high financial loss
    const costs = await this.inspectRepo.createQueryBuilder('i')
      .select('SUM(i.costEstimate)', 'totalCost')
      .getRawOne();
    const totalCost = costs?.totalCost || 0;
    if (totalCost > 5000) score -= 10;
    if (totalCost > 20000) score -= 20;

    // Penalize for poor SLA
    const sla = await this.getSlaMetrics();
    const avgDays = parseFloat(sla.averageResolutionDays as string) || 0;
    if (avgDays > 5) score -= 5;
    if (avgDays > 10) score -= 15;

    // Ensure score stays between 0 and 100
    if (score < 0) score = 0;
    if (score > 100) score = 100;

    return {
      score,
      trend: score >= 80 ? 'EXCELLENT' : score >= 60 ? 'FAIR' : 'POOR'
    };
  }
}
