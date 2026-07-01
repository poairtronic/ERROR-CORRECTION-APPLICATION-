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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = exports.AuditActionType = void 0;
const typeorm_1 = require("typeorm");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const user_entity_1 = require("../users/user.entity");
var AuditActionType;
(function (AuditActionType) {
    AuditActionType["STATUS_CHANGE"] = "STATUS_CHANGE";
    AuditActionType["FIELD_EDIT"] = "FIELD_EDIT";
    AuditActionType["INVENTORY_UPDATED"] = "INVENTORY_UPDATED";
    AuditActionType["COMPONENT_ISSUED"] = "COMPONENT_ISSUED";
    AuditActionType["SALARY_DEDUCTION_CREATED"] = "SALARY_DEDUCTION_CREATED";
    AuditActionType["VENDOR_FAULT_CREATED"] = "VENDOR_FAULT_CREATED";
    AuditActionType["IMAGE_UPLOADED"] = "IMAGE_UPLOADED";
})(AuditActionType || (exports.AuditActionType = AuditActionType = {}));
let AuditLog = class AuditLog {
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => defect_report_entity_1.DefectReport),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", defect_report_entity_1.DefectReport)
], AuditLog.prototype, "report", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id' }),
    __metadata("design:type", String)
], AuditLog.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'actor_id' }),
    __metadata("design:type", user_entity_1.User)
], AuditLog.prototype, "actor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id' }),
    __metadata("design:type", String)
], AuditLog.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AuditLog.prototype, "actorRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AuditActionType }),
    __metadata("design:type", String)
], AuditLog.prototype, "actionType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "fieldName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "oldValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "newValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "fromStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "toStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AuditLog.prototype, "timestamp", void 0);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)('audit_log')
], AuditLog);
//# sourceMappingURL=audit-log.entity.js.map