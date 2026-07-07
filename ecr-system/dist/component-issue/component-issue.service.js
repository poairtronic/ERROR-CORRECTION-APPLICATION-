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
exports.ComponentIssueService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const component_issue_entity_1 = require("./component-issue.entity");
const component_entity_1 = require("../master-data/components/component.entity");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
const role_enum_1 = require("../common/enums/role.enum");
let ComponentIssueService = class ComponentIssueService {
    constructor(componentIssueRepo, componentRepo, defectReportRepo, auditRepo, dataSource, events) {
        this.componentIssueRepo = componentIssueRepo;
        this.componentRepo = componentRepo;
        this.defectReportRepo = defectReportRepo;
        this.auditRepo = auditRepo;
        this.dataSource = dataSource;
        this.events = events;
    }
    async issueComponents(storeManagerId, dto) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const report = await queryRunner.manager.findOne(defect_report_entity_1.DefectReport, {
                where: { id: dto.reportId },
            });
            if (!report) {
                throw new common_1.NotFoundException('Defect Report not found');
            }
            if (report.status !== report_status_enum_1.ReportStatus.APPROVED) {
                throw new common_1.BadRequestException(`Cannot issue components. Report status is ${report.status}, expected APPROVED.`);
            }
            for (const item of dto.components) {
                const component = await queryRunner.manager.findOne(component_entity_1.Component, {
                    where: { id: item.componentId },
                });
                if (!component) {
                    throw new common_1.NotFoundException(`Component ${item.componentId} not found`);
                }
                if (component.stockQty < item.qty) {
                    throw new common_1.BadRequestException(`Insufficient stock for component ${component.name}. Requested: ${item.qty}, Available: ${component.stockQty}`);
                }
                const oldQty = component.stockQty;
                component.stockQty -= item.qty;
                await queryRunner.manager.save(component);
                await queryRunner.manager.save(queryRunner.manager.create(audit_log_entity_1.AuditLog, {
                    reportId: report.id,
                    actorId: storeManagerId,
                    actorRole: role_enum_1.Role.STORE_MANAGER,
                    actionType: audit_log_entity_1.AuditActionType.INVENTORY_UPDATED,
                    fieldName: `Component:${component.code}`,
                    oldValue: oldQty.toString(),
                    newValue: component.stockQty.toString(),
                    note: 'Stock decremented for component issue',
                }));
            }
            const componentIssue = queryRunner.manager.create(component_issue_entity_1.ComponentIssue, {
                reportId: dto.reportId,
                storeManagerId: storeManagerId,
                issuedToId: dto.issuedToId,
                components: dto.components,
                remarks: dto.remarks,
            });
            const savedIssue = await queryRunner.manager.save(componentIssue);
            const oldStatus = report.status;
            report.status = report_status_enum_1.ReportStatus.COMPONENTS_ISSUED;
            await queryRunner.manager.save(report);
            await queryRunner.manager.save(queryRunner.manager.create(audit_log_entity_1.AuditLog, {
                reportId: report.id,
                actorId: storeManagerId,
                actorRole: role_enum_1.Role.STORE_MANAGER,
                actionType: audit_log_entity_1.AuditActionType.STATUS_CHANGE,
                fromStatus: oldStatus,
                toStatus: report.status,
                note: 'Components issued',
            }));
            await queryRunner.manager.save(queryRunner.manager.create(audit_log_entity_1.AuditLog, {
                reportId: report.id,
                actorId: storeManagerId,
                actorRole: role_enum_1.Role.STORE_MANAGER,
                actionType: audit_log_entity_1.AuditActionType.COMPONENT_ISSUED,
                oldValue: '',
                newValue: savedIssue.id,
                note: `Issue record created for ${dto.components.length} components`,
            }));
            await queryRunner.commitTransaction();
            this.events.emit('component.issued', {
                reportId: report.id,
                issueId: savedIssue.id,
                issuedToId: dto.issuedToId,
            });
            this.events.emit('report.status.changed', {
                reportId: report.id,
                reportNumber: report.reportNumber,
                status: report.status,
            });
            return savedIssue;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getIssuesByReport(reportId) {
        return this.componentIssueRepo.find({
            where: { reportId },
            relations: ['storeManager', 'issuedTo'],
        });
    }
};
exports.ComponentIssueService = ComponentIssueService;
exports.ComponentIssueService = ComponentIssueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(component_issue_entity_1.ComponentIssue)),
    __param(1, (0, typeorm_1.InjectRepository)(component_entity_1.Component)),
    __param(2, (0, typeorm_1.InjectRepository)(defect_report_entity_1.DefectReport)),
    __param(3, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        event_emitter_1.EventEmitter2])
], ComponentIssueService);
//# sourceMappingURL=component-issue.service.js.map