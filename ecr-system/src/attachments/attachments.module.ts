import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportAttachment } from './report-attachment.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { CloudinaryService } from './cloudinary.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportAttachment, DefectReport])],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, CloudinaryService],
  exports: [AttachmentsService, CloudinaryService],
})
export class AttachmentsModule {}

