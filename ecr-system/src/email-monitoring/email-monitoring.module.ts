import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailLog } from '../email/entities/email-log.entity';
import { EmailMonitoringAuditLog } from './entities/email-monitoring-audit-log.entity';
import { User } from '../users/user.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { Notification } from '../notifications/notification.entity';
import { EmailMonitoringService } from './email-monitoring.service';
import { EmailMonitoringController } from './email-monitoring.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailLog,
      EmailMonitoringAuditLog,
      User,
      DefectReport,
      Notification,
    ]),
  ],
  providers: [EmailMonitoringService],
  controllers: [EmailMonitoringController],
  exports: [EmailMonitoringService],
})
export class EmailMonitoringModule {}
