import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { DefectReport } from '../../defect-reports/defect-report.entity';
import { Role } from '../../common/enums/role.enum';
import { NotificationChannel } from '../../common/enums/report-status.enum';
import { NotificationsService } from '../notifications.service';
import { NotificationEvent } from '../../email/enums/notification-event.enum';

@Injectable()
export class EventNotificationHandler {
  private readonly logger = new Logger(EventNotificationHandler.name);

  constructor(
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(DefectReport) private readonly reportsRepo: Repository<DefectReport>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleComponentIssued(payload: { reportId: string; issueId: string; issuedToId: string }, frontendUrl: string) {
    try {
      const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
      if (!user) return;

      const report = await this.reportsRepo.findOne({
        where: { id: payload.reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval'],
      });

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
            url: `${frontendUrl}/reports/${payload.reportId}`,
          },
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed handling component.issued event: ${err.message}`, err.stack);
    }
  }

  async handleSalaryDeductionCreated(payload: { deductionId: string; operatorId: string; amount: number; reportId: string }, frontendUrl: string) {
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

  async handleVendorFaultCreated(payload: { faultId: string; vendorId: string; reportId: string }, frontendUrl: string) {
    try {
      const adminUsers = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });
      const report = await this.reportsRepo.findOne({
        where: { id: payload.reportId },
        relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval'],
      });

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
              url: `${frontendUrl}/reports/${payload.reportId}`,
            },
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed handling vendor.fault.created event: ${err.message}`, err.stack);
    }
  }
}
