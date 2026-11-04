import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { ReportSequence } from '../defect-reports/report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { ComponentIssue } from '../component-issue/component-issue.entity';
import { DefectReportsWorkflowService } from '../defect-reports/defect-reports-workflow.service';
import { RmIntakeDto } from './dto/rm-intake.dto';
import { MaterialIssuedDto } from './dto/material-issued.dto';
import {
  ReportStatus,
  RaisedByRole,
  Decision,
} from '../common/enums/report-status.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(DefectReport)
    private readonly reportsRepo: Repository<DefectReport>,
    @InjectRepository(ReportSequence)
    private readonly sequenceRepo: Repository<ReportSequence>,
    private readonly workflowService: DefectReportsWorkflowService,
  ) {}

  async findById(id: string): Promise<DefectReport> {
    return (await this.reportsRepo.findOne({
      where: { id },
      relations: ['inspectionDetail'],
    })) as DefectReport;
  }

  async createFromRM(dto: RmIntakeDto): Promise<{ reportId: string; reportNumber: string }> {
    try {
      return await this.reportsRepo.manager.transaction(async (manager: EntityManager) => {
        const year = new Date().getFullYear();
        let seq = await manager.findOne(ReportSequence, {
          where: { id: 'AGIPL' },
          lock: { mode: 'pessimistic_write' },
        });

        if (!seq) {
          seq = manager.create(ReportSequence, { id: 'AGIPL', lastValue: 0 });
        }

        seq.lastValue += 1;
        await manager.save(seq);
        const reportNumber = `AGIPL-${year}-ERR-${String(seq.lastValue).padStart(5, '0')}`;

        const report = manager.create(DefectReport, {
          scOrPoNo: `${dto.scNumber} / ${dto.poNumber}`,
          scNo: dto.scNumber,
          poNo: dto.poNumber,
          componentName: dto.component,
          quantity: dto.quantityAffected,
          stageOfFailure: dto.stageOfFailure || dto.rejectionFailedStage || 'General',
          defectDescription: dto.defectDescription,
          errorTypeName: dto.errorType ?? (null as any),
          reworkDescription: dto.reworkDescription ?? (null as any),
          rejectionDescription: dto.rejectionDescription ?? (null as any),
          rejectionProcessTemplate: dto.rejectionProcessTemplate ?? (null as any),
          rejectionFailedStage: dto.rejectionFailedStage ?? (null as any),
          rejectionStageCosts: dto.rejectionStageCosts ?? (null as any),
          inspectionType: dto.type,
          raisedByRole: RaisedByRole.OPERATOR,
          raisedById: null as any,
          status: ReportStatus.PENDING_ACCOUNTS_REVIEW,
          images: [],
          reportNumber,
        });

        const savedReport = await manager.save(report);

        const validResponsibleParties = [
          'OPERATOR',
          'VENDOR',
          'PROCESS',
          'MACHINE',
          'CUSTOMER',
          'MATERIAL',
          'INLINE_QUALITY',
          'VENDOR_QUALITY',
          'DESIGN_TEAM',
        ];

        const responsibleParty = validResponsibleParties.includes(
          dto.responsibleParty?.toUpperCase() as string
        )
          ? (dto.responsibleParty!.toUpperCase() as any)
          : null;

        const inspectionRepo = manager.getRepository(InspectionDetail);
        const inspection = inspectionRepo.create({
          reportId: savedReport.id,
          inspectorId: null as any,
          responsibleParty,
          reworkDescription: dto.reworkDescription ?? null,
          rejectionDescription: dto.rejectionDescription ?? null,
          rejectionProcessTemplate: dto.rejectionProcessTemplate ?? null,
          rejectionFailedStage: dto.rejectionFailedStage ?? null,
          rejectionStageCosts: dto.rejectionStageCosts ?? null,
          costEstimate: dto.costEstimation ?? 0,
          lossAmount: dto.lossEstimation ?? null,
          alternativeNote: dto.alternativeNotes ?? null,
          decision: (dto.type === 'REWORK' ? Decision.REWORK : Decision.SCRAP) as any,
        } as any);
        await inspectionRepo.save(inspection);

        return {
          reportId: savedReport.id,
          reportNumber: savedReport.reportNumber,
        };
      });
    } catch (err: any) {
      console.error('RM Intake Error:', err);
      throw new InternalServerErrorException(
        err?.message || 'Failed to create report from RM intake'
      );
    }
  }

  async handleMaterialIssued(dto: MaterialIssuedDto): Promise<{
    success: boolean;
    message?: string;
    reportNumber?: string;
    newStatus?: string;
  }> {
    const report = await this.reportsRepo.findOne({
      where: { reportNumber: dto.reportNumber },
    });

    if (!report) {
      throw new NotFoundException(
        `Defect report with report number ${dto.reportNumber} not found`,
      );
    }

    if (
      report.status === ReportStatus.COMPONENTS_ISSUED ||
      report.status === ReportStatus.CLOSED
    ) {
      return { success: true, message: 'Already processed' };
    }

    const issueRepo = this.reportsRepo.manager.getRepository(ComponentIssue);
    const componentIssue = issueRepo.create({
      reportId: report.id,
      issuedToId: null as any,
      components: [
        {
          componentName: report.componentName,
          qty: dto.issuedQty,
          source: 'RM_VSMART',
        },
      ] as any,
      remarks: `Issued from RM/V-Smart by ${dto.issuedByName} on ${dto.issuedAt}. Stock TX: ${dto.stockTransactionId}`,
    });
    await issueRepo.save(componentIssue);

    report.componentsIssued = true;
    report.componentsIssuedAt = new Date(dto.issuedAt);
    report.componentsIssuedById = 'RM_SYSTEM';
    report.status = ReportStatus.COMPONENTS_ISSUED;
    await this.reportsRepo.save(report);

    this.workflowService.emitStatusChange(
      report,
      ReportStatus.COMPONENTS_ISSUED,
      {
        id: 'RM_SYSTEM',
        name: dto.issuedByName,
        role: Role.STORE_MANAGER,
      } as any,
      'Components Issued',
      `Issued from RM/V-Smart by ${dto.issuedByName} on ${dto.issuedAt}. Stock TX: ${dto.stockTransactionId}`,
    );

    return {
      success: true,
      reportNumber: dto.reportNumber,
      newStatus: 'COMPONENTS_ISSUED',
    };
  }
  async getApprovedReportsForRm() {
    const reports = await this.reportsRepo.find({
      where: { status: ReportStatus.APPROVED },
      order: { createdAt: 'DESC' },
    });

    return reports.map((r) => ({
      ecrId: r.id,
      reportNumber: r.reportNumber,
      type: r.inspectionType || 'REWORK',
      scNumber: r.scNo || r.scOrPoNo || 'N/A',
      poNumber: r.poNo || r.scOrPoNo || 'N/A',
      component: r.componentName || 'Unknown',
      quantityAffected: r.quantity || 1,
      approvedAt: r.updatedAt ? r.updatedAt.toISOString() : r.createdAt.toISOString(),
      componentsIssued: !!r.componentsIssued,
    }));
  }
}
