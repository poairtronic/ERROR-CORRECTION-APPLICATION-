import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from './notifications.service';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import { ReportStatus } from '../common/enums/report-status.enum';
import { NotificationChannel } from '../common/enums/report-status.enum';

interface StatusChangedEvent {
  reportId: string;
  reportNo: string;
  status: ReportStatus;
}

// Recipient resolution table (see project plan) - who gets notified per new status
const RECIPIENT_ROLE_BY_STATUS: Partial<Record<ReportStatus, Role[]>> = {
  [ReportStatus.PENDING_INSPECTION]: [Role.INSPECTOR],
  [ReportStatus.PENDING_SM_REVIEW]: [Role.SENIOR_MANAGER],
  [ReportStatus.PENDING_GM_APPROVAL]: [Role.GENERAL_MANAGER],
  [ReportStatus.APPROVED]: [Role.SALES, Role.STORE_MANAGER],
  [ReportStatus.COMPONENTS_ISSUED]: [], // operator notified directly by id, see component-issue module (Phase 3)
  [ReportStatus.CLOSED]: [Role.GENERAL_MANAGER, Role.SENIOR_MANAGER, Role.INSPECTOR],
};

@Injectable()
export class NotificationListener {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  @OnEvent('report.status.changed')
  async handleStatusChanged(event: StatusChangedEvent) {
    const roles = RECIPIENT_ROLE_BY_STATUS[event.status];
    if (!roles || roles.length === 0) return;

    const recipients = await this.usersRepo.find({
      where: roles.map((role) => ({ role, isActive: true })),
    });

    const message = `Report ${event.reportNo} is now ${event.status.replace(/_/g, ' ')}. Please review.`;

    for (const user of recipients) {
      await this.notificationsService.send({
        userId: user.id,
        userEmail: user.email,
        reportId: event.reportId,
        channel: NotificationChannel.EMAIL,
        type: event.status,
        message,
      });
      await this.notificationsService.send({
        userId: user.id,
        userEmail: user.email,
        reportId: event.reportId,
        channel: NotificationChannel.APP,
        type: event.status,
        message,
      });
    }
  }

  @OnEvent('component.issued')
  async handleComponentIssued(payload: { reportId: string, issueId: string, issuedToId: string }) {
    const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
    if (!user) return;

    const message = `Components have been issued to you for Defect Report.`;
    
    await this.notificationsService.send({
      userId: user.id,
      userEmail: user.email,
      reportId: payload.reportId,
      channel: NotificationChannel.APP,
      type: 'COMPONENT_ISSUED',
      message,
    });
  }

  @OnEvent('salary.deduction.created')
  async handleSalaryDeductionCreated(payload: { deductionId: string, operatorId: string, amount: number }) {
    const user = await this.usersRepo.findOne({ where: { id: payload.operatorId } });
    if (!user) return;

    const message = `A salary deduction of ${payload.amount} has been created for you.`;
    
    await this.notificationsService.send({
      userId: user.id,
      userEmail: user.email,
      reportId: payload.deductionId, // using deductionId as reference
      channel: NotificationChannel.APP,
      type: 'SALARY_DEDUCTION_CREATED',
      message,
    });
  }

  @OnEvent('vendor.fault.created')
  async handleVendorFaultCreated(payload: { faultId: string, vendorId: string, reportId: string }) {
    const admins = await this.usersRepo.find({ where: { role: Role.ADMIN, isActive: true } });
    
    const message = `A vendor fault has been recorded for report ${payload.reportId}.`;
    
    for (const admin of admins) {
      await this.notificationsService.send({
        userId: admin.id,
        userEmail: admin.email,
        reportId: payload.reportId,
        channel: NotificationChannel.APP,
        type: 'VENDOR_FAULT_CREATED',
        message,
      });
    }
  }
}
