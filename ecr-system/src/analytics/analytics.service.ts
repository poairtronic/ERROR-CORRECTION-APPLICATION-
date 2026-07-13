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
import { Vendor } from '../master-data/vendors/vendor.entity';
import { Component } from '../master-data/components/component.entity';
import { Operator } from '../master-data/operators/operator.entity';

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
    const [
      totalReports,
      openReports,
      pendingInspect,
      pendingSm,
      pendingGm,
      pendingStore,
      costs,
      vendorCases,
    ] = await Promise.all([
      this.reportsRepo.count(),
      this.reportsRepo.count({
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
      }),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } }),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_SM_REVIEW } }),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_GM_APPROVAL } }),
      this.reportsRepo.count({ where: { status: ReportStatus.APPROVED, componentsIssued: false } }),
      this.inspectRepo.createQueryBuilder('i')
        .select('SUM(i.costEstimate)', 'totalCost')
        .addSelect('SUM(i.lossAmount)', 'totalLoss')
        .getRawOne(),
      this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } }),
    ]);

    const closedReports = totalReports - openReports;

    return {
      totalReports,
      openReports,
      closedReports,
      pendingInspect,
      pendingSm,
      pendingGm,
      pendingStore,
      totalCost: costs?.totalCost ? parseFloat(costs.totalCost) : 0,
      totalLoss: costs?.totalLoss ? parseFloat(costs.totalLoss) : 0,
      vendorCases,
    };
  }

  async getTrends() {
    // defects grouped by month (PostgreSQL query)
    const monthly = await this.reportsRepo.createQueryBuilder('r')
      .select("to_char(r.createdAt, 'YYYY-MM')", 'month')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();

    // defects grouped by day (PostgreSQL query)
    const daily = await this.reportsRepo.createQueryBuilder('r')
      .select("to_char(r.createdAt, 'YYYY-MM-DD')", 'day')
      .addSelect('COUNT(r.id)', 'count')
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    return { monthly, daily };
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
      .leftJoin(Vendor, 'v', 'CAST(v.id AS varchar) = i.responsibleId')
      .select('v.name', 'vendor')
      .addSelect('COUNT(i.id)', 'defects')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.VENDOR })
      .groupBy('v.name')
      .orderBy('defects', 'DESC')
      .getRawMany();
  }

  async getOperatorIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .leftJoin(Operator, 'o', 'CAST(o.id AS varchar) = i.responsibleId')
      .select('o.name', 'operator')
      .addSelect('COUNT(i.id)', 'reportsRaised')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.OPERATOR })
      .groupBy('o.name')
      .orderBy('reportsRaised', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getMachineIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .leftJoin(Component, 'c', 'CAST(c.id AS varchar) = i.responsibleId')
      .select('c.name', 'machine')
      .addSelect('COUNT(i.id)', 'failures')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.MACHINE })
      .groupBy('c.name')
      .orderBy('failures', 'DESC')
      .getRawMany();
  }

  async getSlaMetrics() {
    const [result, pendingInspect, pendingSm, pendingGm, pendingStore] = await Promise.all([
      this.reportsRepo.createQueryBuilder('r')
        .select('AVG(EXTRACT(EPOCH FROM (r.updatedAt - r.createdAt)) / 86400.0)', 'avgResolutionDays')
        .where('r.status = :status', { status: ReportStatus.CLOSED })
        .getRawOne(),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } }),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_SM_REVIEW } }),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_GM_APPROVAL } }),
      this.reportsRepo.count({ where: { status: ReportStatus.APPROVED, componentsIssued: false } }),
    ]);

    return {
      averageResolutionDays: result?.avgResolutionDays ? parseFloat(result.avgResolutionDays).toFixed(1) : 0,
      inspectionQueue: pendingInspect,
      smQueue: pendingSm,
      gmQueue: pendingGm,
      storeQueue: pendingStore
    };
  }}
