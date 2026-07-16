import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Role } from '../common/enums/role.enum';
import { ReportStatus, ResponsibleParty, NotificationChannel, RaisedByRole } from '../common/enums/report-status.enum';
import { NotificationsService } from './notifications.service';
import { EmailService } from '../email/services/email.service';
import { NotificationEvent } from '../email/enums/notification-event.enum';

interface StatusChangedEvent {
  reportId: string;
  reportNumber: string;
  status: ReportStatus;
  fromStatus?: ReportStatus;
  actor?: { id: string; role: Role };
  actionTaken?: string;
  comments?: string;
  messageToSm?: string;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(DefectReport) private reportsRepo: Repository<DefectReport>,
    private notificationsService: NotificationsService,
    private configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
  }

  private async fetchReportWithRelations(reportId: string): Promise<DefectReport | null> {
    return this.reportsRepo.findOne({
      where: { id: reportId },
      relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval'],
    });
  }

  private async buildEmailSummary(report: DefectReport, event: StatusChangedEvent): Promise<Record<string, string>> {
    const raiser = report.raisedBy?.name || 'Unknown';
    let actionByName = 'System';
    if (event.actor?.id) {
      try {
        const actorUser = await this.usersRepo.findOne({ where: { id: event.actor.id } });
        if (actorUser) {
          actionByName = actorUser.name;
        } else {
          actionByName = event.actor.role;
        }
      } catch (err) {
        actionByName = event.actor.role;
      }
    }

    return {
      'Report Number': report.reportNumber || 'N/A',
      'Current Status': report.status || 'N/A',
      'Previous Status': event.fromStatus || 'N/A',
      'Submitted By': raiser,
      'Action Taken': event.actionTaken || 'Status Updated',
      'Action By': actionByName,
      'Timestamp': new Date().toLocaleString('en-IN'),
      'Comments': event.comments || 'No comments provided',
      'Direct Report Link': `${this.frontendUrl}/reports/${report.id}`,
    };
  }

  private async notifyAdmins(
    report: DefectReport,
    type: string,
    subject: string,
    message: string,
    summary: Record<string, string>,
  ) {
    try {
      const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });
      await Promise.all(
        adminUsers.map(admin =>
          this.notificationsService.create({
            userId: admin.id,
            userEmail: admin.email,
            channel: NotificationChannel.APP_AND_EMAIL,
            type,
            message,
            event: NotificationEvent.REPORT_UPDATED,
            subject,
            reportId: report.id,
            templateData: {
              title: subject,
              message,
              summaryTable: summary,
              primaryButton: {
                text: 'View Report',
                url: `${this.frontendUrl}/reports/${report.id}`,
              },
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to send notification to admin: ${err.message}`);
    }
  }

  @OnEvent('report.status.changed')
  async handleStatusChanged(event: StatusChangedEvent) {
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 3] Listener Triggered: report.status.changed (Report ID: ${event.reportId}, Status: ${event.status})`);
    let report: DefectReport | null;
    try {
      report = await this.fetchReportWithRelations(event.reportId);
    } catch (error) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to fetch report with relations.\nReason: ${error.message}\nFile: notification.listener.ts\nMethod: handleStatusChanged\nStack: ${error.stack}`);
      return; // Don't throw - just log and return
    }

    if (!report) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Report ID not found in database.\nReason: Report ID ${event.reportId} does not exist\nFile: notification.listener.ts\nMethod: handleStatusChanged`);
      return;
    }

    try {
      switch (event.status) {
        case ReportStatus.PENDING_INSPECTION:
          await this.handlePendingInspection(report, event);
          break;
        case ReportStatus.PENDING_ACCOUNTS_REVIEW:
          await this.handlePendingAccountsReview(report, event);
          break;
        case ReportStatus.PENDING_SM_REVIEW:
          await this.handlePendingSmReview(report, event);
          break;
        case ReportStatus.PENDING_GM_APPROVAL:
          await this.handlePendingGmApproval(report, event);
          break;
        case ReportStatus.APPROVED:
          await this.handleApproved(report, event);
          break;
        case ReportStatus.COMPONENTS_ISSUED:
          await this.handleComponentsIssued(report, event);
          break;
        case ReportStatus.REJECTED:
          await this.handleRejected(report, event);
          break;
        case ReportStatus.REWORK_IN_PROGRESS:
          await this.handleReworkInProgress(report, event);
          break;
        case ReportStatus.NEW_PRODUCTION:
          await this.handleNewProduction(report, event);
          break;
        case ReportStatus.CLOSED:
          await this.handleClosed(report, event);
          break;
        default:
          break;
      }
    } catch (error: any) {
      this.logger.error(
        `[NOTIFICATION_ERROR] Failed to process notifications for report ${event.reportId} (status: ${event.status}): ${error.message}`,
        error.stack,
      );
      // Don't re-throw - notification failures should not crash the report operation
    }
  }

  private async handlePendingInspection(report: DefectReport, event: StatusChangedEvent) {
    const inspectors = await this.usersRepo.find({ where: { role: Role.INSPECTOR, isActive: true } });
    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(inspectors.map(inspector =>
      this.notificationsService.create({
        userId: inspector.id,
        userEmail: inspector.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'New Defect Report',
        message: 'A new Defect Report has been submitted by an Operator and requires your inspection.',
        event: NotificationEvent.REPORT_CREATED,
        subject: 'New Defect Report Pending Inspection',
        reportId: report.id,
        templateData: {
          title: 'New Defect Report Pending Your Inspection',
          message: 'A new Defect Report has been submitted by an Operator and requires your inspection.',
          summaryTable,
          primaryButton: {
            text: 'Open Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  private async handlePendingAccountsReview(report: DefectReport, event: StatusChangedEvent) {
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(accountsUsers.map(accounts =>
      this.notificationsService.create({
        userId: accounts.id,
        userEmail: accounts.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'New ECR Pending Verification',
        message: 'A new Defect Report has been submitted/inspected and requires financial verification.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: 'New ECR Pending Accounts Verification',
        reportId: report.id,
        templateData: {
          title: 'ECR Pending Accounts Verification',
          message: 'A new Defect Report has been submitted/inspected and requires financial verification.',
          summaryTable,
          primaryButton: {
            text: 'Verify Cost',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  private async handlePendingSmReview(report: DefectReport, event: StatusChangedEvent) {
    const smUsers = await this.usersRepo.find({ where: { role: Role.SENIOR_MANAGER, isActive: true } });
    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(smUsers.map(sm =>
      this.notificationsService.create({
        userId: sm.id,
        userEmail: sm.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'New ECR Pending Review',
        message: 'A new Defect Report has been submitted by an Inspector and requires your review.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: 'New ECR Pending Review',
        reportId: report.id,
        templateData: {
          title: 'New Defect Report Pending Your Review',
          message: 'A new Defect Report has been submitted by an Inspector and requires your review.',
          summaryTable,
          primaryButton: {
            text: 'Open Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  private async handlePendingGmApproval(report: DefectReport, event: StatusChangedEvent) {
    const gmUsers = await this.usersRepo.find({ where: { role: Role.GENERAL_MANAGER, isActive: true } });
    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(gmUsers.map(gm =>
      this.notificationsService.create({
        userId: gm.id,
        userEmail: gm.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'Pending GM Approval',
        message: 'The Senior Manager has approved this report and forwarded it for your final decision.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: 'Pending GM Approval',
        reportId: report.id,
        templateData: {
          title: 'Report Pending Final Approval',
          message: 'The Senior Manager has approved this report and forwarded it for your final decision.',
          summaryTable,
          primaryButton: {
            text: 'Open Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  private async handleApproved(report: DefectReport, event: StatusChangedEvent) {
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    const storeUsers = await this.usersRepo.find({ where: { role: Role.STORE_MANAGER, isActive: true } });
    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all([
      ...accountsUsers.map(accounts =>
        this.notificationsService.create({
          userId: accounts.id,
          userEmail: accounts.email,
          channel: NotificationChannel.APP_AND_EMAIL,
          type: 'Report Approved',
          message: 'A defect report has been fully approved by the General Manager.',
          event: NotificationEvent.REPORT_APPROVED,
          subject: `Approved Report: ${report.reportNumber}`,
          reportId: report.id,
          templateData: {
            title: 'Defect Report Approved',
            message: 'A defect report has been fully approved by the General Manager.',
            summaryTable,
            primaryButton: {
              text: 'View Details',
              url: `${this.frontendUrl}/reports/${report.id}`,
            },
          },
        })
      ),
      ...storeUsers.map(store =>
        this.notificationsService.create({
          userId: store.id,
          userEmail: store.email,
          channel: NotificationChannel.APP_AND_EMAIL,
          type: 'Action Required',
          message: 'A defect report has been approved and requires components to be issued.',
          event: NotificationEvent.REPORT_APPROVED,
          subject: `Action Required - Approved Report: ${report.reportNumber}`,
          reportId: report.id,
          templateData: {
            title: 'Component Issue Request',
            message: 'A defect report has been approved and requires components to be issued.',
            summaryTable,
            primaryButton: {
              text: 'Issue Components',
              url: `${this.frontendUrl}/reports/${report.id}`,
            },
          },
        })
      ),
    ]);

    await this.notifyAdmins(
      report,
      'Report Approved',
      `Approved Report: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} has been fully approved by the General Manager.`,
      summaryTable,
    );

    await this.sendPrivateReportToSm(report, event);
  }

  private async handleComponentsIssued(report: DefectReport, event: StatusChangedEvent) {
    const notifyIds = new Set<string>();
    
    // Notify Accounts
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    accountsUsers.forEach(u => notifyIds.add(u.id));

    // Notify Inspector who raised/inspected it
    const inspectorId = report.inspectionDetail?.inspectorId || (report.raisedByRole === RaisedByRole.INSPECTOR ? report.raisedById : null);
    if (inspectorId) notifyIds.add(inspectorId);

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(usersToNotify.map(user =>
      this.notificationsService.create({
        userId: user.id,
        userEmail: user.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'Components Issued',
        message: 'The required replacement components have been successfully issued by the Store Manager.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: `Components Issued: ${report.reportNumber}`,
        reportId: report.id,
        templateData: {
          title: 'Components Issued Successfully',
          message: 'The required replacement components have been successfully issued by the Store Manager.',
          summaryTable,
          primaryButton: {
            text: 'View Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));

    await this.notifyAdmins(
      report,
      'Components Issued',
      `Components Issued: ${report.reportNumber}`,
      `The required replacement components have been successfully issued by the Store Manager.`,
      summaryTable,
    );
  }

  private async handleRejected(report: DefectReport, event: StatusChangedEvent) {
    const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });

    const notifyIds = new Set<string>();
    if (inspectorId) notifyIds.add(inspectorId);
    accountsUsers.forEach(accounts => notifyIds.add(accounts.id));

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    const summaryTable = await this.buildEmailSummary(report, event);

    await Promise.all(usersToNotify.map(user =>
      this.notificationsService.create({
        userId: user.id,
        userEmail: user.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'Report Rejected',
        message: 'The report was rejected during the review/approval stage.',
        event: NotificationEvent.REPORT_REJECTED,
        subject: `Report Rejected: ${report.reportNumber}`,
        reportId: report.id,
        templateData: {
          title: 'Report Rejected',
          message: 'The report was rejected during the review/approval stage.',
          summaryTable,
          primaryButton: {
            text: 'View Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));

    await this.notifyAdmins(
      report,
      'Report Rejected',
      `Report Rejected: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} was rejected.`,
      summaryTable,
    );

    await this.sendPrivateReportToSm(report, event);
  }

  private async sendPrivateReportToSm(report: DefectReport, event: StatusChangedEvent) {
    const smUsers = await this.usersRepo.find({ where: { role: Role.SENIOR_MANAGER, isActive: true } });
    if (smUsers.length === 0) return;

    // Build specialized private report summary containing all fields + both GM descriptions
    const privateSummary: Record<string, string> = {
      'Report Number': report.reportNumber || 'N/A',
      'Status': report.status || 'N/A',
      'Component Name': report.componentName || '—',
      'Error Type': report.errorTypeName || report.inspectionDetail?.errorType || '—',
      'SC Number': report.scNo || '—',
      'PO Number': report.poNo || '—',
      'Stage of Failure': report.rejectionFailedStage || report.inspectionDetail?.rejectionFailedStage || report.stageOfFailure || '—',
      'Quantity Affected': report.quantity?.toString() || '—',
      'Defect Description': report.defectDescription || '—',
      'Cost Estimate': report.inspectionDetail?.costEstimate !== undefined ? `$${report.inspectionDetail.costEstimate}` : '—',
      'Loss Estimate': report.inspectionDetail?.lossAmount !== null && report.inspectionDetail?.lossAmount !== undefined ? `$${report.inspectionDetail.lossAmount}` : '—',
      'Rework Description': report.inspectionDetail?.reworkDescription || report.reworkDescription || '—',
      'Rejection Description': report.inspectionDetail?.rejectionDescription || report.rejectionDescription || '—',
      'Alternative Notes': report.inspectionDetail?.alternativeNote || '—',
      'General Manager Decision Notes': event.comments || 'No comments provided',
      'General Manager Message to Senior Manager (Private)': event.messageToSm || 'No private message provided',
      'Report Link': `${this.frontendUrl}/reports/${report.id}`,
    };

    await Promise.all(
      smUsers.map(sm =>
        this.notificationsService.create({
          userId: sm.id,
          userEmail: sm.email,
          channel: NotificationChannel.APP_AND_EMAIL,
          type: 'Private GM Report',
          message: `General Manager has submitted a private decision report for ${report.reportNumber}.`,
          event: NotificationEvent.REPORT_UPDATED,
          subject: `[PRIVATE] GM Decision Report: ${report.reportNumber}`,
          reportId: report.id,
          templateData: {
            title: `Private General Manager Decision Report`,
            message: `This is a private report containing the General Manager's final decision notes and private message to the Senior Manager.`,
            summaryTable: privateSummary,
            primaryButton: {
              text: 'Open Report',
              url: `${this.frontendUrl}/reports/${report.id}`,
            },
          },
        })
      )
    );
  }

  private async handleClosed(report: DefectReport, event: StatusChangedEvent) {
    const summaryTable = await this.buildEmailSummary(report, event);
    await this.notifyAdmins(
      report,
      'Report Closed',
      `Completed/Closed Report: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} has been fully completed and closed.`,
      summaryTable,
    );
  }

  private async handleReworkInProgress(report: DefectReport, event: StatusChangedEvent) {
    const summaryTable = await this.buildEmailSummary(report, event);
    const notifyIds = new Set<string>();
    
    if (report.raisedById) notifyIds.add(report.raisedById);
    if (report.inspectionDetail?.inspectorId) notifyIds.add(report.inspectionDetail.inspectorId);

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    await Promise.all(usersToNotify.map(user =>
      this.notificationsService.create({
        userId: user.id,
        userEmail: user.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'Rework In Progress',
        message: 'The components for this defect have been issued and physical rework has started.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: `Rework Started: ${report.reportNumber}`,
        reportId: report.id,
        templateData: {
          title: 'Physical Rework in Progress',
          message: 'The physical rework process for this defect report has commenced.',
          summaryTable,
          primaryButton: {
            text: 'View Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  private async handleNewProduction(report: DefectReport, event: StatusChangedEvent) {
    const summaryTable = await this.buildEmailSummary(report, event);
    const notifyIds = new Set<string>();
    
    if (report.raisedById) notifyIds.add(report.raisedById);
    if (report.inspectionDetail?.inspectorId) notifyIds.add(report.inspectionDetail.inspectorId);

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    await Promise.all(usersToNotify.map(user =>
      this.notificationsService.create({
        userId: user.id,
        userEmail: user.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'New Production Started',
        message: 'The defect report has transitioned to New Production phase.',
        event: NotificationEvent.REPORT_UPDATED,
        subject: `New Production: ${report.reportNumber}`,
        reportId: report.id,
        templateData: {
          title: 'New Production Initiated',
          message: 'The defect report has transitioned to New Production phase as part of resolution.',
          summaryTable,
          primaryButton: {
            text: 'View Report',
            url: `${this.frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  @OnEvent('component.issued')
  async handleComponentIssued(payload: { reportId: string, issueId: string, issuedToId: string }) {
    try {
      const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
      if (!user) return;
      
      const report = await this.fetchReportWithRelations(payload.reportId);

      await this.notificationsService.create({
        userId: user.id,
        userEmail: user.email,
        channel: NotificationChannel.APP_AND_EMAIL,
        type: 'Components Issued',
        message: `Components have been issued to you for Defect Report ${report?.reportNumber || payload.reportId}.`,
        event: NotificationEvent.COMPONENT_ISSUED,
        subject: 'Components Issued',
        reportId: payload.reportId,
        templateData: {
          title: 'Components Issued for Report',
          message: `Components have been issued to you for Defect Report ${report?.reportNumber || payload.reportId}.`,
          summaryTable: {
            'Issued Components': 'See system for details',
            'Store Manager': 'N/A', 
            'Issue Time': new Date().toISOString(),
          },
          primaryButton: {
            text: 'View Details',
            url: `${this.frontendUrl}/reports/${payload.reportId}`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed handling component.issued event: ${err.message}`, err.stack);
    }
  }

  @OnEvent('salary.deduction.created')
  async handleSalaryDeductionCreated(payload: { deductionId: string, operatorId: string, amount: number, reportId: string }) {
    try {
      const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });

      for (const admin of adminUsers) {
        await this.notificationsService.create({
          userId: admin.id,
          userEmail: admin.email,
          channel: NotificationChannel.APP_AND_EMAIL,
          type: 'Salary Deduction',
          message: 'A new salary deduction has been recorded in the system.',
          event: NotificationEvent.SALARY_DEDUCTION,
          subject: 'New Salary Deduction Logged',
          reportId: payload.reportId,
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
    } catch (err: any) {
      this.logger.error(`Failed handling salary.deduction.created event: ${err.message}`, err.stack);
    }
  }

  @OnEvent('vendor.fault.created')
  async handleVendorFaultCreated(payload: { faultId: string, vendorId: string, reportId: string }) {
    try {
      const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });
      const report = await this.fetchReportWithRelations(payload.reportId);
      
      for (const admin of adminUsers) {
        await this.notificationsService.create({
          userId: admin.id,
          userEmail: admin.email,
          channel: NotificationChannel.APP_AND_EMAIL,
          type: 'Vendor Fault',
          message: 'A vendor fault has been formally recorded and requires attention.',
          event: NotificationEvent.VENDOR_FAULT,
          subject: `Vendor Fault Logged: ${report?.reportNumber || payload.reportId}`,
          reportId: payload.reportId,
          templateData: {
            title: 'Vendor Fault Recorded',
            message: 'A vendor fault has been formally recorded and requires attention.',
            summaryTable: {
              'Fault ID': payload.faultId,
              'Vendor ID': payload.vendorId,
              'Report Number': report?.reportNumber || payload.reportId,
            },
            primaryButton: {
              text: 'View Report',
              url: `${this.frontendUrl}/reports/${payload.reportId}`,
            },
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed handling vendor.fault.created event: ${err.message}`, err.stack);
    }
  }
}
