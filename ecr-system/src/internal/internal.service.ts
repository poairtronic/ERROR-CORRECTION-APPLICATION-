import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { DefectReport } from '../defect-reports/defect-report.entity';
import { ReportSequence } from '../defect-reports/report-sequence.entity';
import { InspectionDetail } from '../inspection/inspection-detail.entity';
import { RmIntakeDto } from './dto/rm-intake.dto';
import { ReportStatus, RaisedByRole, Decision } from '../common/enums/report-status.enum';

@Injectable()
export class InternalService {
  constructor(
    @InjectRepository(DefectReport)
    private readonly reportsRepo: Repository<DefectReport>,
    @InjectRepository(ReportSequence)
    private readonly sequenceRepo: Repository<ReportSequence>,
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
          stageOfFailure: dto.stageOfFailure,
          defectDescription: dto.defectDescription,
          errorTypeName: dto.errorType ?? (null as any),
          reworkDescription: dto.reworkDescription ?? (null as any),
          rejectionDescription: dto.rejectionDescription ?? (null as any),
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
}
