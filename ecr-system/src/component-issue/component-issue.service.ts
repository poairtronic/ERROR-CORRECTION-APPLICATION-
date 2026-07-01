import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ComponentIssue } from './component-issue.entity';
import { CreateComponentIssueDto } from './dto/create-component-issue.dto';
import { Component } from '../master-data/components/component.entity';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { ReportStatus } from '../common/enums/report-status.enum';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ComponentIssueService {
  constructor(
    @InjectRepository(ComponentIssue)
    private readonly componentIssueRepo: Repository<ComponentIssue>,
    @InjectRepository(Component)
    private readonly componentRepo: Repository<Component>,
    @InjectRepository(DefectReport)
    private readonly defectReportRepo: Repository<DefectReport>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly events: EventEmitter2,
  ) {}

  async issueComponents(
    storeManagerId: string,
    dto: CreateComponentIssueDto,
  ): Promise<ComponentIssue> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const report = await queryRunner.manager.findOne(DefectReport, {
        where: { id: dto.reportId },
      });

      if (!report) {
        throw new NotFoundException('Defect Report not found');
      }

      if (report.status !== ReportStatus.APPROVED) {
        throw new BadRequestException(
          `Cannot issue components. Report status is ${report.status}, expected APPROVED.`,
        );
      }

      for (const item of dto.components) {
        const component = await queryRunner.manager.findOne(Component, {
          where: { id: item.componentId },
        });

        if (!component) {
          throw new NotFoundException(`Component ${item.componentId} not found`);
        }

        if (component.stockQty < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for component ${component.name}. Requested: ${item.qty}, Available: ${component.stockQty}`,
          );
        }

        const oldQty = component.stockQty;
        component.stockQty -= item.qty;
        await queryRunner.manager.save(component);

        // Audit log for inventory change
        await queryRunner.manager.save(
          queryRunner.manager.create(AuditLog, {
            reportId: report.id,
            actorId: storeManagerId,
            actorRole: Role.STORE_MANAGER,
            actionType: AuditActionType.INVENTORY_UPDATED,
            fieldName: `Component:${component.code}`,
            oldValue: oldQty.toString(),
            newValue: component.stockQty.toString(),
            note: 'Stock decremented for component issue',
          }),
        );
      }

      const componentIssue = queryRunner.manager.create(ComponentIssue, {
        reportId: dto.reportId,
        storeManagerId: storeManagerId,
        issuedToId: dto.issuedToId,
        components: dto.components,
        remarks: dto.remarks,
      });

      const savedIssue = await queryRunner.manager.save(componentIssue);

      // Workflow State Transition
      const oldStatus = report.status;
      report.status = ReportStatus.COMPONENTS_ISSUED;
      await queryRunner.manager.save(report);

      await queryRunner.manager.save(
        queryRunner.manager.create(AuditLog, {
          reportId: report.id,
          actorId: storeManagerId,
          actorRole: Role.STORE_MANAGER,
          actionType: AuditActionType.STATUS_CHANGE,
          fromStatus: oldStatus,
          toStatus: report.status,
          note: 'Components issued',
        }),
      );

      await queryRunner.manager.save(
        queryRunner.manager.create(AuditLog, {
          reportId: report.id,
          actorId: storeManagerId,
          actorRole: Role.STORE_MANAGER,
          actionType: AuditActionType.COMPONENT_ISSUED,
          oldValue: '',
          newValue: savedIssue.id,
          note: `Issue record created for ${dto.components.length} components`,
        }),
      );

      await queryRunner.commitTransaction();

      // Emit events for notification
      this.events.emit('component.issued', {
        reportId: report.id,
        issueId: savedIssue.id,
        issuedToId: dto.issuedToId,
      });
      
      this.events.emit('report.status.changed', {
        reportId: report.id,
        reportNo: report.reportNo,
        status: report.status,
      });

      return savedIssue;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getIssuesByReport(reportId: string): Promise<ComponentIssue[]> {
    return this.componentIssueRepo.find({
      where: { reportId },
      relations: ['storeManager', 'issuedTo'],
    });
  }
}
