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
exports.ComponentIssue = void 0;
const typeorm_1 = require("typeorm");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const user_entity_1 = require("../users/user.entity");
let ComponentIssue = class ComponentIssue {
};
exports.ComponentIssue = ComponentIssue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ComponentIssue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => defect_report_entity_1.DefectReport, (r) => r.componentIssues),
    (0, typeorm_1.JoinColumn)({ name: 'report_id' }),
    __metadata("design:type", defect_report_entity_1.DefectReport)
], ComponentIssue.prototype, "report", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'report_id' }),
    __metadata("design:type", String)
], ComponentIssue.prototype, "reportId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'store_manager_id' }),
    __metadata("design:type", user_entity_1.User)
], ComponentIssue.prototype, "storeManager", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'store_manager_id' }),
    __metadata("design:type", String)
], ComponentIssue.prototype, "storeManagerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Array)
], ComponentIssue.prototype, "components", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'issued_to_id' }),
    __metadata("design:type", user_entity_1.User)
], ComponentIssue.prototype, "issuedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'issued_to_id' }),
    __metadata("design:type", String)
], ComponentIssue.prototype, "issuedToId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], ComponentIssue.prototype, "remarks", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ComponentIssue.prototype, "issuedAt", void 0);
exports.ComponentIssue = ComponentIssue = __decorate([
    (0, typeorm_1.Entity)('component_issue')
], ComponentIssue);
//# sourceMappingURL=component-issue.entity.js.map