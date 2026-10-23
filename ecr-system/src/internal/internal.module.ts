import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { ReportSequence } from '../defect-reports/report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { DefectReportsModule } from '../defect-reports/defect-reports.module';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DefectReport, ReportSequence, InspectionDetail]),
    DefectReportsModule,
  ],
  controllers: [InternalController],
  providers: [InternalService],
})
export class InternalModule {}
