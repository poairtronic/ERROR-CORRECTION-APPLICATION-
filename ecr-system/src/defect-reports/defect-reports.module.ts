import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectReport } from './defect-report.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { SmReview } from '../sm-review/sm-review.entity';
import { GmApproval } from '../gm-approval/gm-approval.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
import { ReportSequence } from './report-sequence.entity';
import { DefectReportsService } from './defect-reports.service';
import { DefectReportsWorkflowService } from './defect-reports-workflow.service';
import { DefectReportsImageService } from './defect-reports-image.service';
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
      ReportSequence,
    ]),
  ],
  controllers: [DefectReportsController],
  providers: [
    DefectReportsService,
    DefectReportsWorkflowService,
    DefectReportsImageService,
  ],
  exports: [
    DefectReportsService,
    DefectReportsWorkflowService,
    DefectReportsImageService,
  ],
})
export class DefectReportsModule {}
