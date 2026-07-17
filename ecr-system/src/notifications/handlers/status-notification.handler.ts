import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { DefectReport } from '../../defect-reports/defect-report.entity';
import { Role } from '../../common/enums/role.enum';
import { ReportStatus, NotificationChannel, RaisedByRole } from '../../common/enums/report-status.enum';
import { NotificationsService } from '../notifications.service';
import { NotificationEvent } from '../../email/enums/notification-event.enum';
import { StatusChangedEvent } from './event-interfaces';

@Injectable()
export class StatusNotificationHandler {
  private readonly logger = new Logger(StatusNotificationHandler.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(DefectReport) private readonly reportsRepo: Repository<DefectReport>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handlePendingInspection(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const inspectors = await this.usersRepo.find({ where: { role: Role.INSPECTOR, isActive: true } });
    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  async handlePendingAccountsReview(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  async handlePendingSmReview(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const smUsers = await this.usersRepo.find({ where: { role: Role.SENIOR_MANAGER, isActive: true } });
    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  async handlePendingGmApproval(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const gmUsers = await this.usersRepo.find({ where: { role: Role.GENERAL_MANAGER, isActive: true } });
    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  async handleApproved(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>, notifyAdmins: (report: DefectReport, type: string, subject: string, message: string, summary: Record<string, string>) => Promise<void>, sendPrivateReportToSm: (report: DefectReport, event: StatusChangedEvent, frontendUrl: string) => Promise<void>) {
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    const storeUsers = await this.usersRepo.find({ where: { role: Role.STORE_MANAGER, isActive: true } });
    const summaryTable = await buildEmailSummary(report, event);

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
              url: `${frontendUrl}/reports/${report.id}`,
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
              url: `${frontendUrl}/reports/${report.id}`,
            },
          },
        })
      ),
    ]);

    await notifyAdmins(
      report,
      'Report Approved',
      `Approved Report: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} has been fully approved by the General Manager.`,
      summaryTable,
    );

    await sendPrivateReportToSm(report, event, frontendUrl);
  }

  async handleComponentsIssued(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>, notifyAdmins: (report: DefectReport, type: string, subject: string, message: string, summary: Record<string, string>) => Promise<void>) {
    const notifyIds = new Set<string>();
    
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });
    accountsUsers.forEach(u => notifyIds.add(u.id));

    const inspectorId = report.inspectionDetail?.inspectorId || (report.raisedByRole === RaisedByRole.INSPECTOR ? report.raisedById : null);
    if (inspectorId) notifyIds.add(inspectorId);

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));

    await notifyAdmins(
      report,
      'Components Issued',
      `Components Issued: ${report.reportNumber}`,
      `The required replacement components have been successfully issued by the Store Manager.`,
      summaryTable,
    );
  }

  async handleRejected(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>, notifyAdmins: (report: DefectReport, type: string, subject: string, message: string, summary: Record<string, string>) => Promise<void>, sendPrivateReportToSm: (report: DefectReport, event: StatusChangedEvent, frontendUrl: string) => Promise<void>) {
    const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;
    const accountsUsers = await this.usersRepo.find({ where: { role: Role.ACCOUNTS, isActive: true } });

    const notifyIds = new Set<string>();
    if (inspectorId) notifyIds.add(inspectorId);
    accountsUsers.forEach(accounts => notifyIds.add(accounts.id));

    const usersToNotify = await this.usersRepo.find({
      where: Array.from(notifyIds).map(id => ({ id })),
    });

    const summaryTable = await buildEmailSummary(report, event);

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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));

    await notifyAdmins(
      report,
      'Report Rejected',
      `Report Rejected: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} was rejected.`,
      summaryTable,
    );

    await sendPrivateReportToSm(report, event, frontendUrl);
  }

  async sendPrivateReportToSm(report: DefectReport, event: StatusChangedEvent, frontendUrl: string) {
    const smUsers = await this.usersRepo.find({ where: { role: Role.SENIOR_MANAGER, isActive: true } });
    if (smUsers.length === 0) return;

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
      'Report Link': `${frontendUrl}/reports/${report.id}`,
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
              url: `${frontendUrl}/reports/${report.id}`,
            },
          },
        })
      )
    );
  }

  async handleClosed(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>, notifyAdmins: (report: DefectReport, type: string, subject: string, message: string, summary: Record<string, string>) => Promise<void>) {
    const summaryTable = await buildEmailSummary(report, event);
    await notifyAdmins(
      report,
      'Report Closed',
      `Completed/Closed Report: ${report.reportNumber}`,
      `Defect report ${report.reportNumber} has been fully completed and closed.`,
      summaryTable,
    );
  }

  async handleReworkInProgress(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const summaryTable = await buildEmailSummary(report, event);
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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }

  async handleNewProduction(report: DefectReport, event: StatusChangedEvent, frontendUrl: string, buildEmailSummary: (report: DefectReport, event: StatusChangedEvent) => Promise<Record<string, string>>) {
    const summaryTable = await buildEmailSummary(report, event);
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
            url: `${frontendUrl}/reports/${report.id}`,
          },
        },
      })
    ));
  }
}
