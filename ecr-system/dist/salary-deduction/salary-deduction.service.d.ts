import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SalaryDeduction } from './salary-deduction.entity';
import { CreateSalaryDeductionDto, UpdateSalaryDeductionStatusDto } from './dto/salary-deduction.dto';
import { AuditLog } from '../audit-log/audit-log.entity';
export declare class SalaryDeductionService {
    private readonly deductionRepo;
    private readonly auditRepo;
    private readonly events;
    constructor(deductionRepo: Repository<SalaryDeduction>, auditRepo: Repository<AuditLog>, events: EventEmitter2);
    create(dto: CreateSalaryDeductionDto, actorId: string, actorRole: string): Promise<SalaryDeduction>;
    updateStatus(id: string, dto: UpdateSalaryDeductionStatusDto, actorId: string, actorRole: string): Promise<SalaryDeduction>;
    getByReport(reportId: string): Promise<SalaryDeduction[]>;
    getByOperator(operatorId: string): Promise<SalaryDeduction[]>;
    handleOperatorFault(payload: {
        report: any;
        gmId: string;
    }): Promise<void>;
}
