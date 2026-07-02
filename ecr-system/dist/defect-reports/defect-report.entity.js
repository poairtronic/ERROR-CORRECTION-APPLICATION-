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
exports.DefectReport = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const inspection_detail_entity_1 = require("../inspection/inspection-detail.entity");
const sm_review_entity_1 = require("../sm-review/sm-review.entity");
const gm_approval_entity_1 = require("../gm-approval/gm-approval.entity");
const component_issue_entity_1 = require("../component-issue/component-issue.entity");
let DefectReport = class DefectReport {
};
exports.DefectReport = DefectReport;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DefectReport.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "reportNo", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'raised_by_id' }),
    __metadata("design:type", user_entity_1.User)
], DefectReport.prototype, "raisedBy", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'raised_by_id' }),
    __metadata("design:type", String)
], DefectReport.prototype, "raisedById", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-enum', enum: report_status_enum_1.RaisedByRole }),
    __metadata("design:type", String)
], DefectReport.prototype, "raisedByRole", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DefectReport.prototype, "scOrPoNo", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "productId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "componentName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "errorTypeName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "partNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], DefectReport.prototype, "batchNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], DefectReport.prototype, "quantity", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], DefectReport.prototype, "stageOfFailure", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], DefectReport.prototype, "defectDescription", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-json', default: '[]' }),
    __metadata("design:type", Array)
], DefectReport.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'simple-enum', enum: report_status_enum_1.ReportStatus, default: report_status_enum_1.ReportStatus.DRAFT }),
    __metadata("design:type", String)
], DefectReport.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => inspection_detail_entity_1.InspectionDetail, (i) => i.report, { nullable: true }),
    __metadata("design:type", inspection_detail_entity_1.InspectionDetail)
], DefectReport.prototype, "inspectionDetail", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => sm_review_entity_1.SmReview, (s) => s.report, { nullable: true }),
    __metadata("design:type", sm_review_entity_1.SmReview)
], DefectReport.prototype, "smReview", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => gm_approval_entity_1.GmApproval, (g) => g.report, { nullable: true }),
    __metadata("design:type", gm_approval_entity_1.GmApproval)
], DefectReport.prototype, "gmApproval", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => component_issue_entity_1.ComponentIssue, (c) => c.report),
    __metadata("design:type", Array)
], DefectReport.prototype, "componentIssues", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], DefectReport.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], DefectReport.prototype, "updatedAt", void 0);
exports.DefectReport = DefectReport = __decorate([
    (0, typeorm_1.Entity)('defect_reports')
], DefectReport);
//# sourceMappingURL=defect-report.entity.js.map