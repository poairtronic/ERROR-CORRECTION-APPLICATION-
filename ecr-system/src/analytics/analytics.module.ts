import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DefectReport,
      InspectionDetail,
      SmReview,
      GmApproval,
      ComponentIssue,
      AuditLog,
    ]),
  ],
  providers: [AnalyticsService],
  controllers: [AnalyticsController]
})
export class AnalyticsModule {}
