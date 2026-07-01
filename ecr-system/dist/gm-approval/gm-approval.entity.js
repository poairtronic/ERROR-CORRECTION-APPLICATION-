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
exports.GmApproval = void 0;
const typeorm_1 = require("typeorm");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const user_entity_1 = require("../users/user.entity");
let GmApproval = class GmApproval {
};
exports.GmApproval = GmApproval;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], GmApproval.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => defect_report_entity_1.DefectReport, (r) => r.gmApproval),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", defect_report_entity_1.DefectReport)
], GmApproval.prototype, "report", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id' }),
    __metadata("design:type", String)
], GmApproval.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'gm_id' }),
    __metadata("design:type", user_entity_1.User)
], GmApproval.prototype, "generalManager", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gm_id' }),
    __metadata("design:type", String)
], GmApproval.prototype, "gmId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Boolean)
], GmApproval.prototype, "approved", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], GmApproval.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], GmApproval.prototype, "budgetApproved", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], GmApproval.prototype, "approvedAt", void 0);
exports.GmApproval = GmApproval = __decorate([
    (0, typeorm_1.Entity)('gm_approval')
], GmApproval);
//# sourceMappingURL=gm-approval.entity.js.map