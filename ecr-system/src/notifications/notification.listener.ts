import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Role } from '../common/enums/role.enum';
import { ReportStatus, ResponsibleParty } from '../common/enums/report-status.enum';
import { NotificationsService } from './notifications.service';
import { EmailService } from '../email/services/email.service';
import { NotificationEvent } from '../email/enums/notification-event.enum';

interface StatusChangedEvent {
  reportId: string;
  reportNo: string;
  status: ReportStatus;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(DefectReport) private reportsRepo: Repository<DefectReport>,
    private notificationsService: NotificationsService, // legacy fallback if needed
    @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
  ) {}

  private async fetchReportWithRelations(reportId: string): Promise<DefectReport | null> {
    return this.reportsRepo.findOne({
      where: { id: reportId },
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval'],
    });
  }

  @OnEvent('report.status.changed')
  async handleStatusChanged(event: StatusChangedEvent) {
    const report = await this.fetchReportWithRelations(event.reportId);
    if (!report) return;

    switch (event.status) {
      case ReportStatus.PENDING_SM_REVIEW:
        await this.handlePendingSmReview(report);
        break;
      case ReportStatus.PENDING_GM_APPROVAL:
        await this.handlePendingGmApproval(report);
        break;
      case ReportStatus.APPROVED:
        await this.handleApproved(report);
        break;
      case ReportStatus.REJECTED:
        await this.handleRejected(report);
        break;
      default:
        break;
    }
  }

  private async handlePendingSmReview(report: DefectReport) {
    const smUsers = await this.usersRepo.find({ where: { role: Role.SENIOR_MANAGER, isActive: true } });
    const inspector = report.inspectionDetail?.inspectorId 
      ? await this.usersRepo.findOne({ where: { id: report.inspectionDetail.inspectorId } })
      : report.raisedBy;

    const summaryTable = {
      'Report Number': report.reportNo,
      'Product': report.productId,
      'Component': report.componentName,
      'Error Type': report.inspectionDetail?.errorType || report.errorTypeName,
      'Responsible Party': report.inspectionDetail?.responsibleParty || 'N/A',
      'Estimated Cost': report.inspectionDetail?.costEstimate?.toString() || 'N/A',
      'Estimated Time': report.inspectionDetail?.timeEstimateHours?.toString() || 'N/A',
      'Inspector': inspector?.name || 'Unknown',
      'Submission Time': report.createdAt.toISOString(),
    };

    for (const sm of smUsers) {
      await this.emailService.queueEmail({
        recipient: sm.email,
        subject: 'New ECR Pending Review',
        event: NotificationEvent.REPORT_UPDATED,
        relatedReportId: report.id,
        templateData: {
          title: 'New Defect Report Pending Your Review',
          message: 'A new Defect Report has been submitted by an Inspector and requires your review.',
          summaryTable,
          primaryButton: {
            text: 'Open Report',
            url: `http://localhost:5173/reports/${report.id}`,
          },
        },
      });
    }
  }

  private async handlePendingGmApproval(report: DefectReport) {
    const gmUsers = await this.usersRepo.find({ where: { role: Role.GENERAL_MANAGER, isActive: true } });
    
    const summaryTable = {
      'Report Number': report.reportNo,
      'Inspector Summary': report.inspectionDetail?.errorType || 'N/A',
      'Estimated Cost': report.inspectionDetail?.costEstimate?.toString() || 'N/A',
      'Estimated Time': report.inspectionDetail?.timeEstimateHours?.toString() || 'N/A',
      'Remarks': report.inspectionDetail?.alternativeNote || 'None',
      'SM Notes': report.smReview?.decisionNote || 'None',
    };

    for (const gm of gmUsers) {
      await this.emailService.queueEmail({
        recipient: gm.email,
        subject: 'Pending GM Approval',
        event: NotificationEvent.REPORT_UPDATED,
        relatedReportId: report.id,
        templateData: {
          title: 'Report Pending Final Approval',
          message: 'The Senior Manager has approved this report and forwarded it for your final decision.',
          summaryTable,
          primaryButton: {
            text: 'Open Report',
            url: `http://localhost:5173/reports/${report.id}`,
          },
        },
      });
    }
  }

  private async handleApproved(report: DefectReport) {
    const salesUsers = await this.usersRepo.find({ where: { role: Role.SALES, isActive: true } });
    const storeUsers = await this.usersRepo.find({ where: { role: Role.STORE_MANAGER, isActive: true } });

    const salesSummary = {
      'Report Number': report.reportNo,
      'Budget': report.gmApproval?.budgetApproved?.toString() || 'N/A',
      'Customer Impact': report.inspectionDetail?.timeEstimateHours ? 'Potential Delay' : 'Minimal',
      'Remarks': report.gmApproval?.remarks || 'None',
    };

    for (const sales of salesUsers) {
      await this.emailService.queueEmail({
        recipient: sales.email,
        subject: `Approved Report: ${report.reportNo}`,
        event: NotificationEvent.REPORT_APPROVED,
        relatedReportId: report.id,
        templateData: {
          title: 'Defect Report Approved',
          message: 'A defect report has been fully approved by the General Manager.',
          summaryTable: salesSummary,
          primaryButton: {
            text: 'View Details',
            url: `http://localhost:5173/reports/${report.id}`,
          },
        },
      });
    }

    const storesSummary = {
      'Report Number': report.reportNo,
      'Component Details': report.componentName,
      'Required Action': 'Prepare replacement components',
      'Rework Information': report.defectDescription,
    };

    for (const store of storeUsers) {
      await this.emailService.queueEmail({
        recipient: store.email,
        subject: `Action Required - Approved Report: ${report.reportNo}`,
        event: NotificationEvent.REPORT_APPROVED,
        relatedReportId: report.id,
        templateData: {
          title: 'Component Issue Request',
          message: 'A defect report has been approved and requires components to be issued.',
          summaryTable: storesSummary,
          primaryButton: {
            text: 'Issue Components',
            url: `http://localhost:5173/reports/${report.id}`,
          },
        },
      });
    }
  }

  private async handleRejected(report: DefectReport) {
    if (report.gmApproval && report.gmApproval.approved === false) {
      const smId = report.smReview?.smId;
      const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;

      const notifyIds = new Set<string>();
      if (smId) notifyIds.add(smId);
      if (inspectorId) notifyIds.add(inspectorId);

      const usersToNotify = await this.usersRepo.find({
        where: Array.from(notifyIds).map(id => ({ id })),
      });

      const summaryTable = {
        'Report Number': report.reportNo,
        'Reason': report.gmApproval.remarks || 'No remarks provided',
        'Remarks': 'Rejected by General Manager',
        'Action Required': 'Review rejection and take corrective action if needed.',
      };

      for (const user of usersToNotify) {
        await this.emailService.queueEmail({
          recipient: user.email,
          subject: `Report Rejected: ${report.reportNo}`,
          event: NotificationEvent.REPORT_REJECTED,
          relatedReportId: report.id,
          templateData: {
            title: 'Report Rejected',
            message: 'Your report was rejected during the final approval stage.',
            summaryTable,
            primaryButton: {
              text: 'View Report',
              url: `http://localhost:5173/reports/${report.id}`,
            },
          },
        });
      }
    } 
    else if (report.smReview && report.smReview.forwardedToGm === false) {
      const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;
      const inspector = await this.usersRepo.findOne({ where: { id: inspectorId } });

      if (inspector) {
        await this.emailService.queueEmail({
          recipient: inspector.email,
          subject: `Report Rejected: ${report.reportNo}`,
          event: NotificationEvent.REPORT_REJECTED,
          relatedReportId: report.id,
          templateData: {
            title: 'Report Rejected',
            message: 'Your report was rejected during Senior Manager review.',
            summaryTable: {
              'Report Number': report.reportNo,
              'Reason': report.smReview.decisionNote || 'No reason provided',
              'Remarks': 'Please check the report for details.',
            },
            primaryButton: {
              text: 'View Report',
              url: `http://localhost:5173/reports/${report.id}`,
            },
          },
        });
      }
    }
  }

  @OnEvent('component.issued')
  async handleComponentIssued(payload: { reportId: string, issueId: string, issuedToId: string }) {
    const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
    if (!user) return;
    
    const report = await this.fetchReportWithRelations(payload.reportId);

    await this.emailService.queueEmail({
      recipient: user.email,
      subject: 'Components Issued',
      event: NotificationEvent.COMPONENT_ISSUED,
      relatedReportId: payload.reportId,
      templateData: {
        title: 'Components Issued for Report',
        message: `Components have been issued to you for Defect Report ${report?.reportNo || payload.reportId}.`,
        summaryTable: {
          'Issued Components': 'See system for details',
          'Store Manager': 'N/A', 
          'Issue Time': new Date().toISOString(),
        },
        primaryButton: {
          text: 'View Details',
          url: `http://localhost:5173/reports/${payload.reportId}`,
        },
      },
    });
  }

  @OnEvent('salary.deduction.created')
  async handleSalaryDeductionCreated(payload: { deductionId: string, operatorId: string, amount: number }) {
    const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });

    for (const admin of adminUsers) {
      await this.emailService.queueEmail({
        recipient: admin.email,
        subject: 'New Salary Deduction Logged',
        event: NotificationEvent.SALARY_DEDUCTION,
        relatedReportId: payload.deductionId,
        templateData: {
          title: 'Salary Deduction Record',
          message: 'A new salary deduction has been recorded in the system.',
          summaryTable: {
            'Deduction ID': payload.deductionId,
            'Operator ID': payload.operatorId,
            'Amount': payload.amount.toString(),
          },
        },
      });
    }
  }

  @OnEvent('vendor.fault.created')
  async handleVendorFaultCreated(payload: { faultId: string, vendorId: string, reportId: string }) {
    const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });
    const report = await this.fetchReportWithRelations(payload.reportId);
    
    for (const admin of adminUsers) {
      await this.emailService.queueEmail({
        recipient: admin.email,
        subject: `Vendor Fault Logged: ${report?.reportNo || payload.reportId}`,
        event: NotificationEvent.VENDOR_FAULT,
        relatedReportId: payload.reportId,
        templateData: {
          title: 'Vendor Fault Recorded',
          message: 'A vendor fault has been formally recorded and requires attention.',
          summaryTable: {
            'Fault ID': payload.faultId,
            'Vendor ID': payload.vendorId,
            'Report Number': report?.reportNo || payload.reportId,
          },
          primaryButton: {
            text: 'View Report',
            url: `http://localhost:5173/reports/${payload.reportId}`,
          },
        },
      });
    }
  }
}
