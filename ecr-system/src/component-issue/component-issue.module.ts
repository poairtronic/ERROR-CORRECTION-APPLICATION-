import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComponentIssue } from './component-issue.entity';
import { ComponentIssueService } from './component-issue.service';
import { ComponentIssueController } from './component-issue.controller';
import { Component } from '../master-data/components/component.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { AuditLog } from '../audit-log/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ComponentIssue,
      Component,
      DefectReport,
      AuditLog,
    ]),
  ],
  providers: [ComponentIssueService],
  controllers: [ComponentIssueController],
  exports: [ComponentIssueService],
})
export class ComponentIssueModule {}
