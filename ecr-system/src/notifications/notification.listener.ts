import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Role } from '../common/enums/role.enum';
import { ReportStatus, NotificationChannel } from '../common/enums/report-status.enum';
import { NotificationsService } from './notifications.service';
import { NotificationEvent } from '../email/enums/notification-event.enum';
import { StatusNotificationHandler } from './handlers/status-notification.handler';
import { EventNotificationHandler } from './handlers/event-notification.handler';
import { StatusChangedEvent } from './handlers/event-interfaces';

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(DefectReport) private readonly reportsRepo: Repository<DefectReport>,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly statusHandler: StatusNotificationHandler,
    private readonly eventHandler: EventNotificationHandler,
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
        actionByName = actorUser ? actorUser.name : event.actor.role;
      } catch {
        actionByName = event.actor.role;
      }
    }

    return {
      'Report Number': report.reportNumber || 'N/A',
      'Current Status': report.status || 'N/A',
      'Previous Status': event.fromStatus || 'N/A',
      'Submitted By': raiser,
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
    } catch (err: any) {
      this.logger.error(`Failed to send notification to admin: ${err.message}`);
    }
  }

  @OnEvent('report.status.changed')
  async handleStatusChanged(event: StatusChangedEvent) {
    console.log(`[EMAIL_DIAGNOSTICS] [STEP 3] Listener Triggered: report.status.changed (Report ID: ${event.reportId}, Status: ${event.status})`);
    let report: DefectReport | null;
    try {
      report = await this.fetchReportWithRelations(event.reportId);
    } catch (error: any) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Failed to fetch report with relations.\nReason: ${error.message}\nFile: notification.listener.ts\nMethod: handleStatusChanged\nStack: ${error.stack}`);
      return;
    }

    if (!report) {
      console.error(`[EMAIL_DIAGNOSTICS] [FAILURE] Report ID not found in database.\nReason: Report ID ${event.reportId} does not exist\nFile: notification.listener.ts\nMethod: handleStatusChanged`);
      return;
    }

    const { frontendUrl } = this;
    const buildEmailSummary = this.buildEmailSummary.bind(this);
    const notifyAdmins = this.notifyAdmins.bind(this);

    try {
      switch (event.status) {
        case ReportStatus.PENDING_INSPECTION:
          await this.statusHandler.handlePendingInspection(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.PENDING_ACCOUNTS_REVIEW:
          await this.statusHandler.handlePendingAccountsReview(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.PENDING_SM_REVIEW:
          await this.statusHandler.handlePendingSmReview(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.PENDING_GM_APPROVAL:
          await this.statusHandler.handlePendingGmApproval(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.APPROVED:
          await this.statusHandler.handleApproved(report, event, frontendUrl, buildEmailSummary, notifyAdmins, this.statusHandler.sendPrivateReportToSm.bind(this.statusHandler));
          break;
        case ReportStatus.COMPONENTS_ISSUED:
          await this.statusHandler.handleComponentsIssued(report, event, frontendUrl, buildEmailSummary, notifyAdmins);
          break;
        case ReportStatus.REJECTED:
          await this.statusHandler.handleRejected(report, event, frontendUrl, buildEmailSummary, notifyAdmins, this.statusHandler.sendPrivateReportToSm.bind(this.statusHandler));
          break;
        case ReportStatus.REWORK_IN_PROGRESS:
          await this.statusHandler.handleReworkInProgress(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.NEW_PRODUCTION:
          await this.statusHandler.handleNewProduction(report, event, frontendUrl, buildEmailSummary);
          break;
        case ReportStatus.CLOSED:
          await this.statusHandler.handleClosed(report, event, frontendUrl, buildEmailSummary, notifyAdmins);
          break;
        default:
          break;
      }
    } catch (error: any) {
      this.logger.error(
        `[NOTIFICATION_ERROR] Failed to process notifications for report ${event.reportId} (status: ${event.status}): ${error.message}`,
        error.stack,
      );
    }
  }

  @OnEvent('component.issued')
  async handleComponentIssued(payload: { reportId: string; issueId: string; issuedToId: string }) {
    await this.eventHandler.handleComponentIssued(payload, this.frontendUrl);
  }

  @OnEvent('salary.deduction.created')
  async handleSalaryDeductionCreated(payload: { deductionId: string; operatorId: string; amount: number; reportId: string }) {
    await this.eventHandler.handleSalaryDeductionCreated(payload, this.frontendUrl);
  }

  @OnEvent('vendor.fault.created')
  async handleVendorFaultCreated(payload: { faultId: string; vendorId: string; reportId: string }) {
    await this.eventHandler.handleVendorFaultCreated(payload, this.frontendUrl);
  }
}
