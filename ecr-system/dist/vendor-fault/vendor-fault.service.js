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
exports.VendorFaultService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const role_enum_1 = require("../common/enums/role.enum");
const vendor_fault_log_entity_1 = require("./vendor-fault-log.entity");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
let VendorFaultService = class VendorFaultService {
    constructor(faultRepo, auditRepo, events) {
        this.faultRepo = faultRepo;
        this.auditRepo = auditRepo;
        this.events = events;
    }
    async create(dto, actorId, actorRole) {
        const record = this.faultRepo.create({
            reportId: dto.reportId,
            vendorId: dto.vendorId,
            note: dto.note,
            recoveryStatus: report_status_enum_1.RecoveryStatus.PENDING,
            recoveryAmount: 0,
        });
        const saved = await this.faultRepo.save(record);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: dto.reportId,
            actorId,
            actorRole,
            actionType: audit_log_entity_1.AuditActionType.VENDOR_FAULT_CREATED,
            oldValue: '',
            newValue: saved.id,
            note: `Vendor fault created for vendor ${dto.vendorId}`,
        }));
        this.events.emit('vendor.fault.created', {
            faultId: saved.id,
            vendorId: saved.vendorId,
            reportId: saved.reportId,
        });
        return saved;
    }
    async update(id, dto, actorId, actorRole) {
        const record = await this.faultRepo.findOne({ where: { id } });
        if (!record) {
            throw new common_1.NotFoundException('Vendor fault record not found');
        }
        if (dto.recoveryStatus && dto.recoveryStatus !== record.recoveryStatus) {
            await this.auditRepo.save(this.auditRepo.create({
                reportId: record.reportId,
                actorId,
                actorRole,
                actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
                fieldName: 'VendorFaultLog:recoveryStatus',
                oldValue: record.recoveryStatus,
                newValue: dto.recoveryStatus,
                note: `Recovery status updated`,
            }));
            record.recoveryStatus = dto.recoveryStatus;
            if (dto.recoveryStatus === report_status_enum_1.RecoveryStatus.RECOVERED || dto.recoveryStatus === report_status_enum_1.RecoveryStatus.PARTIALLY_RECOVERED) {
                record.recoveredAt = new Date();
            }
        }
        if (dto.recoveryAmount !== undefined && dto.recoveryAmount !== record.recoveryAmount) {
            await this.auditRepo.save(this.auditRepo.create({
                reportId: record.reportId,
                actorId,
                actorRole,
                actionType: audit_log_entity_1.AuditActionType.FIELD_EDIT,
                fieldName: 'VendorFaultLog:recoveryAmount',
                oldValue: record.recoveryAmount.toString(),
                newValue: dto.recoveryAmount.toString(),
                note: `Recovery amount updated`,
            }));
            record.recoveryAmount = dto.recoveryAmount;
        }
        if (dto.note) {
            record.note = record.note ? `${record.note}\n${dto.note}` : dto.note;
        }
        return this.faultRepo.save(record);
    }
    async getByReport(reportId) {
        return this.faultRepo.find({ where: { reportId }, relations: ['vendor'] });
    }
    async getByVendor(vendorId) {
        return this.faultRepo.find({ where: { vendorId }, relations: ['report'] });
    }
    async handleVendorFault(payload) {
        const { report, gmId } = payload;
        const vendorId = report.inspectionDetail?.responsibleId;
        if (!vendorId) {
            console.warn(`Cannot create vendor fault for report ${report.id}: Missing vendorId`);
            return;
        }
        const note = `Auto-created vendor fault for Defect Report ${report.reportNo}. Notes: ${report.smReview?.decisionNote || ''}`;
        const record = this.faultRepo.create({
            reportId: report.id,
            vendorId,
            note,
            recoveryStatus: report_status_enum_1.RecoveryStatus.PENDING,
            recoveryAmount: 0,
        });
        const saved = await this.faultRepo.save(record);
        await this.auditRepo.save(this.auditRepo.create({
            reportId: report.id,
            actorId: gmId,
            actorRole: role_enum_1.Role.GENERAL_MANAGER,
            actionType: audit_log_entity_1.AuditActionType.VENDOR_FAULT_CREATED,
            oldValue: '',
            newValue: saved.id,
            note: `Auto-created vendor fault for vendor ${vendorId}`,
        }));
        this.events.emit('vendor.fault.created', {
            faultId: saved.id,
            vendorId: saved.vendorId,
            reportId: saved.reportId,
        });
    }
};
exports.VendorFaultService = VendorFaultService;
__decorate([
    (0, event_emitter_1.OnEvent)('report.approved.vendor_fault'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VendorFaultService.prototype, "handleVendorFault", null);
exports.VendorFaultService = VendorFaultService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(vendor_fault_log_entity_1.VendorFaultLog)),
    __param(1, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], VendorFaultService);
//# sourceMappingURL=vendor-fault.service.js.map