import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Role } from '../common/enums/role.enum';
import { SalaryDeduction } from './salary-deduction.entity';
import { CreateSalaryDeductionDto, UpdateSalaryDeductionStatusDto } from './dto/salary-deduction.dto';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';

import { User } from '../users/user.entity';

@Injectable()
export class SalaryDeductionService {
  constructor(
    @InjectRepository(SalaryDeduction)
    private readonly deductionRepo: Repository<SalaryDeduction>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateSalaryDeductionDto, actorId: string, actorRole: string): Promise<SalaryDeduction> {
    return this.deductionRepo.manager.transaction(async (manager) => {
      const deductionRepo = manager.getRepository(SalaryDeduction);
      const auditRepo = manager.getRepository(AuditLog);

      const record = deductionRepo.create({
        reportId: dto.reportId,
        operatorId: dto.operatorId,
        amount: dto.amount,
        reason: dto.reason,
        monthRef: dto.monthRef,
        status: 'PENDING',
      });

      const saved = await deductionRepo.save(record);

      await auditRepo.save(
        auditRepo.create({
          reportId: dto.reportId,
          actorId,
          actorRole,
          actionType: AuditActionType.SALARY_DEDUCTION_CREATED,
          oldValue: '',
          newValue: saved.id,
          note: `Salary deduction created for operator ${dto.operatorId} with amount ${dto.amount}`,
        }),
      );

      this.events.emit('salary.deduction.created', {
        deductionId: saved.id,
        operatorId: saved.operatorId,
        amount: saved.amount,
        reportId: saved.reportId,
      });

      return saved;
    });
  }

  async updateStatus(id: string, dto: UpdateSalaryDeductionStatusDto, actorId: string, actorRole: string): Promise<SalaryDeduction> {
    return this.deductionRepo.manager.transaction(async (manager) => {
      const deductionRepo = manager.getRepository(SalaryDeduction);
      const auditRepo = manager.getRepository(AuditLog);

      const record = await deductionRepo.findOne({ where: { id } });
      if (!record) {
        throw new NotFoundException('Salary deduction record not found');
      }

      const oldStatus = record.status;
      record.status = dto.status;
      
      const saved = await deductionRepo.save(record);

      await auditRepo.save(
        auditRepo.create({
          reportId: record.reportId,
          actorId,
          actorRole,
          actionType: AuditActionType.FIELD_EDIT,
          fieldName: 'SalaryDeduction:status',
          oldValue: oldStatus,
          newValue: dto.status,
          note: `Salary deduction status updated`,
        }),
      );

      return saved;
    });
  }

  async getByReport(reportId: string): Promise<SalaryDeduction[]> {
    return this.deductionRepo.find({ where: { reportId }, relations: ['operator'] });
  }

  async getByOperator(operatorId: string): Promise<SalaryDeduction[]> {
    return this.deductionRepo.find({ where: { operatorId }, relations: ['report'] });
  }

  @OnEvent('report.approved.operator_fault')
  async handleOperatorFault(payload: { report: any, gmId: string }) {
    const { report, gmId } = payload;
    const operatorId = report.inspectionDetail?.responsibleId;
    
    if (!operatorId) {
      console.warn(`Cannot create salary deduction for report ${report.id}: Missing operatorId`);
      return;
    }

    let resolvedOperatorId: string | null = null;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    
    if (uuidRegex.test(operatorId)) {
      const user = await this.userRepo.findOne({ where: { id: operatorId } });
      if (user) {
        resolvedOperatorId = user.id;
      }
    }

    if (!resolvedOperatorId) {
      // 2. Email lookup
      let user = await this.userRepo.findOne({ where: { email: operatorId } });
      
      // 3. Employee ID (salaryRefId) lookup
      if (!user) {
        user = await this.userRepo.findOne({ where: { salaryRefId: operatorId } });
      }
      
      // 4 & 5. Username / Full Name lookup
      if (!user) {
        user = await this.userRepo.findOne({ where: { name: operatorId } });
      }

      if (user) {
        resolvedOperatorId = user.id;
      }
    }

    if (!resolvedOperatorId) {
      console.warn(`[SALARY_DEDUCTION_WARN] Operator user not found for identifier: ${operatorId}. Creating deduction without operator ID.`);
    }

    const amount = report.inspectionDetail?.lossAmount ?? 0;
    const reason = `Auto-created deduction for Defect Report ${report.reportNumber}. Notes: ${report.smReview?.decisionNote || ''}`;
    
    const now = new Date();
    const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
      await this.deductionRepo.manager.transaction(async (manager) => {
        const deductionRepo = manager.getRepository(SalaryDeduction);
        const auditRepo = manager.getRepository(AuditLog);

        const record = deductionRepo.create({
          reportId: report.id,
          operatorId: resolvedOperatorId || undefined,
          amount,
          reason,
          monthRef,
          status: 'PENDING',
        });

        const saved = await deductionRepo.save(record);

        await auditRepo.save(
          auditRepo.create({
            reportId: report.id,
            actorId: gmId,
            actorRole: Role.GENERAL_MANAGER,
            actionType: AuditActionType.SALARY_DEDUCTION_CREATED,
            oldValue: '',
            newValue: saved.id,
            note: `Auto-created salary deduction for operator ${resolvedOperatorId || 'Unknown'} with amount ${amount}`,
          }),
        );

        this.events.emit('salary.deduction.created', {
          deductionId: saved.id,
          operatorId: saved.operatorId,
          amount: saved.amount,
          reportId: saved.reportId,
        });
      });
    } catch (err: any) {
      console.error(`[TRANSACTION_ERROR] Failed auto-creating salary deduction: ${err.message}`, err.stack);
    }
  }
}
