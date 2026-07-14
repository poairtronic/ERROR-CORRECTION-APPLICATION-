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
    const [statusCounts, costs, vendorCases] = await Promise.all([
      this.reportsRepo.createQueryBuilder('r')
        .select('r.status', 'status')
        .addSelect('r.componentsIssued', 'componentsIssued')
        .addSelect('COUNT(r.id)', 'count')
        .groupBy('r.status')
        .addGroupBy('r.componentsIssued')
        .getRawMany(),
      this.inspectRepo.createQueryBuilder('i')
        .select('SUM(i.costEstimate)', 'totalCost')
        .addSelect('SUM(i.lossAmount)', 'totalLoss')
        .getRawOne(),
      this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } }),
    ]);

    let totalReports = 0;
    let openReports = 0;
    let pendingInspect = 0;
    let pendingSm = 0;
    let pendingGm = 0;
    let pendingStore = 0;

    const openStatuses = new Set([
      ReportStatus.DRAFT,
      ReportStatus.PENDING_INSPECTION,
      ReportStatus.PENDING_SM_REVIEW,
      ReportStatus.PENDING_GM_APPROVAL,
      ReportStatus.APPROVED,
      ReportStatus.COMPONENTS_ISSUED,
      ReportStatus.REWORK_IN_PROGRESS,
      ReportStatus.NEW_PRODUCTION,
    ]);

    for (const row of statusCounts) {
      const count = parseInt(row.count) || 0;
      const status = row.status as ReportStatus;
      const componentsIssued = row.componentsIssued === true || row.componentsIssued === 'true' || row.componentsIssued === 1;

      totalReports += count;

      if (openStatuses.has(status)) {
        openReports += count;
      }

      if (status === ReportStatus.PENDING_INSPECTION) {
        pendingInspect += count;
      } else if (status === ReportStatus.PENDING_SM_REVIEW) {
        pendingSm += count;
      } else if (status === ReportStatus.PENDING_GM_APPROVAL) {
        pendingGm += count;
      } else if (status === ReportStatus.APPROVED && !componentsIssued) {
        pendingStore += count;
      }
    }

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

    const [recentVendorDefects, costResult, open] = await Promise.all([
      this.inspectRepo.count({ where: { responsibleParty: ResponsibleParty.VENDOR } }),
      this.inspectRepo.createQueryBuilder('i').select('SUM(i.costEstimate)', 'totalCost').getRawOne(),
      this.reportsRepo.count({ where: { status: ReportStatus.PENDING_INSPECTION } }),
    ]);

    if (recentVendorDefects > 10) {
      insights.push(`High vendor defect rate: ${recentVendorDefects} defects attributed to vendors.`);
    }

    const totalCost = costResult?.totalCost ? parseFloat(costResult.totalCost) : 0;
    if (totalCost > 10000) {
      insights.push(`Rework costs have exceeded budget thresholds (Total: $${totalCost}).`);
    }

    if (open > 5) {
      insights.push(`Inspection bottleneck detected: ${open} reports awaiting inspection.`);
    }

    return insights;
  }

  async getVendorIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .leftJoin(Vendor, 'v', 'v.id = CAST(i.responsibleId AS uuid)')
      .select('v.name', 'vendor')
      .addSelect('COUNT(i.id)', 'defects')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.VENDOR })
      .groupBy('v.name')
      .orderBy('defects', 'DESC')
      .getRawMany();
  }

  async getOperatorIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .leftJoin(Operator, 'o', 'o.id = CAST(i.responsibleId AS uuid)')
      .select('o.name', 'operator')
      .addSelect('COUNT(i.id)', 'reportsRaised')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.OPERATOR })
      .groupBy('o.name')
      .orderBy('"reportsRaised"', 'DESC')
      .limit(10)
      .getRawMany();
  }

  async getMachineIntelligence() {
    return this.inspectRepo.createQueryBuilder('i')
      .leftJoin(Component, 'c', 'c.id = CAST(i.responsibleId AS uuid)')
      .select('c.name', 'machine')
      .addSelect('COUNT(i.id)', 'failures')
      .where('i.responsibleParty = :party', { party: ResponsibleParty.MACHINE })
      .groupBy('c.name')
      .orderBy('failures', 'DESC')
      .getRawMany();
  }

  async getSlaMetrics() {
    const [result, statusCounts] = await Promise.all([
      this.reportsRepo.createQueryBuilder('r')
        .select('AVG(EXTRACT(EPOCH FROM (r.updatedAt - r.createdAt)) / 86400.0)', 'avgResolutionDays')
        .where('r.status = :status', { status: ReportStatus.CLOSED })
        .getRawOne(),
      this.reportsRepo.createQueryBuilder('r')
        .select('r.status', 'status')
        .addSelect('r.componentsIssued', 'componentsIssued')
        .addSelect('COUNT(r.id)', 'count')
        .where('r.status IN (:...statuses)', {
          statuses: [
            ReportStatus.PENDING_INSPECTION,
            ReportStatus.PENDING_SM_REVIEW,
            ReportStatus.PENDING_GM_APPROVAL,
            ReportStatus.APPROVED
          ]
        })
        .groupBy('r.status')
        .addGroupBy('r.componentsIssued')
        .getRawMany(),
    ]);

    let pendingInspect = 0;
    let pendingSm = 0;
    let pendingGm = 0;
    let pendingStore = 0;

    for (const row of statusCounts) {
      const count = parseInt(row.count) || 0;
      const status = row.status as ReportStatus;
      const componentsIssued = row.componentsIssued === true || row.componentsIssued === 'true' || row.componentsIssued === 1;

      if (status === ReportStatus.PENDING_INSPECTION) {
        pendingInspect = count;
      } else if (status === ReportStatus.PENDING_SM_REVIEW) {
        pendingSm = count;
      } else if (status === ReportStatus.PENDING_GM_APPROVAL) {
        pendingGm = count;
      } else if (status === ReportStatus.APPROVED && !componentsIssued) {
        pendingStore = count;
      }
    }

    return {
      averageResolutionDays: result?.avgResolutionDays ? parseFloat(result.avgResolutionDays).toFixed(1) : 0,
      inspectionQueue: pendingInspect,
      smQueue: pendingSm,
      gmQueue: pendingGm,
      storeQueue: pendingStore
    };
  }}
