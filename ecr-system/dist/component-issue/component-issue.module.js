"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComponentIssueModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const component_issue_entity_1 = require("./component-issue.entity");
const component_issue_service_1 = require("./component-issue.service");
const component_issue_controller_1 = require("./component-issue.controller");
const component_entity_1 = require("../master-data/components/component.entity");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
let ComponentIssueModule = class ComponentIssueModule {
};
exports.ComponentIssueModule = ComponentIssueModule;
exports.ComponentIssueModule = ComponentIssueModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([
                component_issue_entity_1.ComponentIssue,
                component_entity_1.Component,
                defect_report_entity_1.DefectReport,
                audit_log_entity_1.AuditLog,
            ]),
        ],
        providers: [component_issue_service_1.ComponentIssueService],
        controllers: [component_issue_controller_1.ComponentIssueController],
        exports: [component_issue_service_1.ComponentIssueService],
    })
], ComponentIssueModule);
//# sourceMappingURL=component-issue.module.js.map