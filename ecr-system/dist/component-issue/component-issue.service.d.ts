import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComponentIssue } from './component-issue.entity';
import { CreateComponentIssueDto } from './dto/create-component-issue.dto';
import { Component } from '../master-data/components/component.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { AuditLog } from '../audit-log/audit-log.entity';
export declare class ComponentIssueService {
    private readonly componentIssueRepo;
    private readonly componentRepo;
    private readonly defectReportRepo;
    private readonly auditRepo;
    private readonly dataSource;
    private readonly events;
    constructor(componentIssueRepo: Repository<ComponentIssue>, componentRepo: Repository<Component>, defectReportRepo: Repository<DefectReport>, auditRepo: Repository<AuditLog>, dataSource: DataSource, events: EventEmitter2);
    issueComponents(storeManagerId: string, dto: CreateComponentIssueDto): Promise<ComponentIssue>;
    getIssuesByReport(reportId: string): Promise<ComponentIssue[]>;
}
