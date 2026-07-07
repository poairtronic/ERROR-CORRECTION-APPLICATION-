"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryDeductionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const role_enum_1 = require("../common/enums/role.enum");
const salary_deduction_entity_1 = require("./salary-deduction.entity");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
let SalaryDeductionService = class SalaryDeductionService {
    constructor(deductionRepo, auditRepo, events) {
        this.deductionRepo = deductionRepo;
        this.auditRepo = auditRepo;
        this.events = events;
    }
    async create(dto, actorId, actorRole) {
        const record = this.deductionRepo.create({
            reportId: dto.reportId,
            operatorId: dto.operatorId,
            amount: dto.amount,
            reason: dto.reason,
            monthRef: dto.monthRef,
            status: 'PENDING',
        });
        const saved = await this.deductionRepo.save(record);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: dto.reportId,
            actorId,
            actorRole,
            actionType: audit_log_entity_1.AuditActionType.SALARY_DEDUCTION_CREATED,
            oldValue: '',
            newValue: saved.id,
            note: `Salary deduction created for operator ${dto.operatorId} with amount ${dto.amount}`,
        }));
        this.events.emit('salary.deduction.created', {
            deductionId: saved.id,
            operatorId: saved.operatorId,
            amount: saved.amount,
        });
        return saved;
    }
    async updateStatus(id, dto, actorId, actorRole) {
        const record = await this.deductionRepo.findOne({ where: { id } });
        if (!record) {
            throw new common_1.NotFoundException('Salary deduction record not found');
        }
        const oldStatus = record.status;
        record.status = dto.status;
        const saved = await this.deductionRepo.save(record);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: record.reportId,
            actorId,
            actorRole,
            actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
            fieldName: 'SalaryDeduction:status',
            oldValue: oldStatus,
            newValue: dto.status,
            note: `Salary deduction status updated`,
        }));
        return saved;
    }
    async getByReport(reportId) {
        return this.deductionRepo.find({ where: { reportId }, relations: ['operator'] });
    }
    async getByOperator(operatorId) {
        return this.deductionRepo.find({ where: { operatorId }, relations: ['report'] });
    }
    async handleOperatorFault(payload) {
        const { report, gmId } = payload;
        const operatorId = report.inspectionDetail?.responsibleId;
        if (!operatorId) {
            console.warn(`Cannot create salary deduction for report ${report.id}: Missing operatorId`);
            return;
        }
        const amount = report.smReview?.lossAmount ?? 0;
        const reason = `Auto-created deduction for Defect Report ${report.reportNumber}. Notes: ${report.smReview?.decisionNote || ''}`;
        const now = new Date();
        const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const record = this.deductionRepo.create({
            reportId: report.id,
            operatorId,
            amount,
            reason,
            monthRef,
            status: 'PENDING',
        });
        const saved = await this.deductionRepo.save(record);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: gmId,
            actorRole: role_enum_1.Role.GENERAL_MANAGER,
            actionType: audit_log_entity_1.AuditActionType.SALARY_DEDUCTION_CREATED,
            oldValue: '',
            newValue: saved.id,
            note: `Auto-created salary deduction for operator ${operatorId} with amount ${amount}`,
        }));
        this.events.emit('salary.deduction.created', {
            deductionId: saved.id,
            operatorId: saved.operatorId,
            amount: saved.amount,
        });
    }
};
exports.SalaryDeductionService = SalaryDeductionService;
__decorate([
    (0, event_emitter_1.OnEvent)('report.approved.operator_fault'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SalaryDeductionService.prototype, "handleOperatorFault", null);
exports.SalaryDeductionService = SalaryDeductionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(salary_deduction_entity_1.SalaryDeduction)),
    __param(1, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], SalaryDeductionService);
//# sourceMappingURL=salary-deduction.service.js.map