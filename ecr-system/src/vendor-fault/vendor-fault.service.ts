import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Role } from '../common/enums/role.enum';
import { VendorFaultLog } from './vendor-fault-log.entity';
import { CreateVendorFaultDto, UpdateVendorFaultDto } from './dto/vendor-fault.dto';
import { AuditLog, AuditActionType } from '../audit-log/audit-log.entity';
import { RecoveryStatus } from '../common/enums/report-status.enum';

@Injectable()
export class VendorFaultService {
  constructor(
    @InjectRepository(VendorFaultLog)
    private readonly faultRepo: Repository<VendorFaultLog>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateVendorFaultDto, actorId: string, actorRole: string): Promise<VendorFaultLog> {
    const record = this.faultRepo.create({
      reportId: dto.reportId,
      vendorId: dto.vendorId,
      note: dto.note,
      recoveryStatus: RecoveryStatus.PENDING,
      recoveryAmount: 0,
    });

    const saved = await this.faultRepo.save(record);

    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: dto.reportId,
        actorId,
        actorRole,
        actionType: AuditActionType.VENDOR_FAULT_CREATED,
        oldValue: '',
        newValue: saved.id,
        note: `Vendor fault created for vendor ${dto.vendorId}`,
      }),
    );

    this.events.emit('vendor.fault.created', {
      faultId: saved.id,
      vendorId: saved.vendorId,
      reportId: saved.reportId,
    });

    return saved;
  }

  async update(id: string, dto: UpdateVendorFaultDto, actorId: string, actorRole: string): Promise<VendorFaultLog> {
    const record = await this.faultRepo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Vendor fault record not found');
    }

    if (dto.recoveryStatus && dto.recoveryStatus !== record.recoveryStatus) {
      await this.auditRepo.save(
        this.auditRepo.create({
          reportId: record.reportId,
          actorId,
          actorRole,
          actionType: AuditActionType.FIELD_EDIT,
          fieldName: 'VendorFaultLog:recoveryStatus',
          oldValue: record.recoveryStatus,
          newValue: dto.recoveryStatus,
          note: `Recovery status updated`,
        }),
      );
      record.recoveryStatus = dto.recoveryStatus;
      
      if (dto.recoveryStatus === RecoveryStatus.RECOVERED || dto.recoveryStatus === RecoveryStatus.PARTIALLY_RECOVERED) {
        record.recoveredAt = new Date();
      }
    }

    if (dto.recoveryAmount !== undefined && dto.recoveryAmount !== record.recoveryAmount) {
      await this.auditRepo.save(
        this.auditRepo.create({
          reportId: record.reportId,
          actorId,
          actorRole,
          actionType: AuditActionType.FIELD_EDIT,
          fieldName: 'VendorFaultLog:recoveryAmount',
          oldValue: record.recoveryAmount.toString(),
          newValue: dto.recoveryAmount.toString(),
          note: `Recovery amount updated`,
        }),
      );
      record.recoveryAmount = dto.recoveryAmount;
    }

    if (dto.note) {
      record.note = record.note ? `${record.note}\n${dto.note}` : dto.note;
    }

    return this.faultRepo.save(record);
  }

  async getByReport(reportId: string): Promise<VendorFaultLog[]> {
    return this.faultRepo.find({ where: { reportId }, relations: ['vendor'] });
  }

  async getByVendor(vendorId: string): Promise<VendorFaultLog[]> {
    return this.faultRepo.find({ where: { vendorId }, relations: ['report'] });
  }

  @OnEvent('report.approved.vendor_fault')
  async handleVendorFault(payload: { report: any, gmId: string }) {
    const { report, gmId } = payload;
    const vendorId = report.inspectionDetail?.responsibleId;

    if (!vendorId) {
      console.warn(`Cannot create vendor fault for report ${report.id}: Missing vendorId`);
      return;
    }

    const note = `Auto-created vendor fault for Defect Report ${report.reportNumber}. Notes: ${report.smReview?.decisionNote || ''}`;

    const record = this.faultRepo.create({
      reportId: report.id,
      vendorId,
      note,
      recoveryStatus: RecoveryStatus.PENDING,
      recoveryAmount: 0,
    });

    const saved = await this.faultRepo.save(record);

    await this.auditRepo.save(
      this.auditRepo.create({
        reportId: report.id,
        actorId: gmId,
        actorRole: Role.GENERAL_MANAGER,
        actionType: AuditActionType.VENDOR_FAULT_CREATED,
        oldValue: '',
        newValue: saved.id,
        note: `Auto-created vendor fault for vendor ${vendorId}`,
      }),
    );

    this.events.emit('vendor.fault.created', {
      faultId: saved.id,
      vendorId: saved.vendorId,
      reportId: saved.reportId,
    });
  }
}
