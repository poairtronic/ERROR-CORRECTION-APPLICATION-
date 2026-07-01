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
exports.SalaryDeduction = void 0;
const typeorm_1 = require("typeorm");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const user_entity_1 = require("../users/user.entity");
let SalaryDeduction = class SalaryDeduction {
};
exports.SalaryDeduction = SalaryDeduction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => defect_report_entity_1.DefectReport),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", defect_report_entity_1.DefectReport)
], SalaryDeduction.prototype, "report", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id' }),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'operator_id' }),
    __metadata("design:type", user_entity_1.User)
], SalaryDeduction.prototype, "operator", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'operator_id' }),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "operatorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], SalaryDeduction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 'PENDING' }),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], SalaryDeduction.prototype, "monthRef", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], SalaryDeduction.prototype, "createdAt", void 0);
exports.SalaryDeduction = SalaryDeduction = __decorate([
    (0, typeorm_1.Entity)('salary_deduction')
], SalaryDeduction);
//# sourceMappingURL=salary-deduction.entity.js.map