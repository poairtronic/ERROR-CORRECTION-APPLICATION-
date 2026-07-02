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
exports.VendorFaultLog = void 0;
const typeorm_1 = require("typeorm");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const vendor_entity_1 = require("../master-data/vendors/vendor.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
let VendorFaultLog = class VendorFaultLog {
};
exports.VendorFaultLog = VendorFaultLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], VendorFaultLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => defect_report_entity_1.DefectReport),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", defect_report_entity_1.DefectReport)
], VendorFaultLog.prototype, "report", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id' }),
    __metadata("design:type", String)
], VendorFaultLog.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => vendor_entity_1.Vendor),
    (0, typeorm_1.JoinColumn)({ name: 'vendor_id' }),
    __metadata("design:type", vendor_entity_1.Vendor)
], VendorFaultLog.prototype, "vendor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'vendor_id' }),
    __metadata("design:type", String)
], VendorFaultLog.prototype, "vendorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], VendorFaultLog.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], VendorFaultLog.prototype, "recoveryAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'simple-enum',
        enum: report_status_enum_1.RecoveryStatus,
        default: report_status_enum_1.RecoveryStatus.PENDING,
    }),
    __metadata("design:type", String)
], VendorFaultLog.prototype, "recoveryStatus", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], VendorFaultLog.prototype, "raisedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], VendorFaultLog.prototype, "recoveredAt", void 0);
exports.VendorFaultLog = VendorFaultLog = __decorate([
    (0, typeorm_1.Entity)('vendor_fault_log')
], VendorFaultLog);
//# sourceMappingURL=vendor-fault-log.entity.js.map