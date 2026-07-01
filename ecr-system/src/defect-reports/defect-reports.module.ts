import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectReport } from './defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { DefectReportsService } from './defect-reports.service';
import { DefectReportsController } from './defect-reports.controller';

import { ImageUploadModule } from '../image-upload/image-upload.module';

@Module({
  imports: [
    ImageUploadModule,
    TypeOrmModule.forFeature([
      DefectReport,
      InspectionDetail,
      SmReview,
      GmApproval,
      AuditLog,
    ]),
  ],
  controllers: [DefectReportsController],
  providers: [DefectReportsService],
  exports: [DefectReportsService],
})
export class DefectReportsModule {}
