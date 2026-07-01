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
exports.NotificationListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const notifications_service_1 = require("./notifications.service");
const user_entity_1 = require("../users/user.entity");
const role_enum_1 = require("../common/enums/role.enum");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const report_status_enum_2 = require("../common/enums/report-status.enum");
const RECIPIENT_ROLE_BY_STATUS = {
    [report_status_enum_1.ReportStatus.PENDING_INSPECTION]: [role_enum_1.Role.INSPECTOR],
    [report_status_enum_1.ReportStatus.PENDING_SM_REVIEW]: [role_enum_1.Role.SENIOR_MANAGER],
    [report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL]: [role_enum_1.Role.GENERAL_MANAGER],
    [report_status_enum_1.ReportStatus.APPROVED]: [role_enum_1.Role.SALES, role_enum_1.Role.STORE_MANAGER],
    [report_status_enum_1.ReportStatus.COMPONENTS_ISSUED]: [],
    [report_status_enum_1.ReportStatus.CLOSED]: [role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.INSPECTOR],
};
let NotificationListener = class NotificationListener {
    constructor(usersRepo, notificationsService) {
        this.usersRepo = usersRepo;
        this.notificationsService = notificationsService;
    }
    async handleStatusChanged(event) {
        const roles = RECIPIENT_ROLE_BY_STATUS[event.status];
        if (!roles || roles.length === 0)
            return;
        const recipients = await this.usersRepo.find({
            where: roles.map((role) => ({ role, isActive: true })),
        });
        const message = `Report ${event.reportNo} is now ${event.status.replace(/_/g, ' ')}. Please review.`;
        for (const user of recipients) {
            await this.notificationsService.send({
                userId: user.id,
                userEmail: user.email,
                reportId: event.reportId,
                channel: report_status_enum_2.NotificationChannel.EMAIL,
                type: event.status,
                message,
            });
            await this.notificationsService.send({
                userId: user.id,
                userEmail: user.email,
                reportId: event.reportId,
                channel: report_status_enum_2.NotificationChannel.APP,
                type: event.status,
                message,
            });
        }
    }
    async handleComponentIssued(payload) {
        const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
        if (!user)
            return;
        const message = `Components have been issued to you for Defect Report.`;
        await this.notificationsService.send({
            userId: user.id,
            userEmail: user.email,
            reportId: payload.reportId,
            channel: report_status_enum_2.NotificationChannel.APP,
            type: 'COMPONENT_ISSUED',
            message,
        });
    }
    async handleSalaryDeductionCreated(payload) {
        const user = await this.usersRepo.findOne({ where: { id: payload.operatorId } });
        if (!user)
            return;
        const message = `A salary deduction of ${payload.amount} has been created for you.`;
        await this.notificationsService.send({
            userId: user.id,
            userEmail: user.email,
            reportId: payload.deductionId,
            channel: report_status_enum_2.NotificationChannel.APP,
            type: 'SALARY_DEDUCTION_CREATED',
            message,
        });
    }
    async handleVendorFaultCreated(payload) {
        const admins = await this.usersRepo.find({ where: { role: role_enum_1.Role.ADMIN, isActive: true } });
        const message = `A vendor fault has been recorded for report ${payload.reportId}.`;
        for (const admin of admins) {
            await this.notificationsService.send({
                userId: admin.id,
                userEmail: admin.email,
                reportId: payload.reportId,
                channel: report_status_enum_2.NotificationChannel.APP,
                type: 'VENDOR_FAULT_CREATED',
                message,
            });
        }
    }
};
exports.NotificationListener = NotificationListener;
__decorate([
    (0, event_emitter_1.OnEvent)('report.status.changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "handleStatusChanged", null);
__decorate([
    (0, event_emitter_1.OnEvent)('component.issued'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "handleComponentIssued", null);
__decorate([
    (0, event_emitter_1.OnEvent)('salary.deduction.created'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "handleSalaryDeductionCreated", null);
__decorate([
    (0, event_emitter_1.OnEvent)('vendor.fault.created'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationListener.prototype, "handleVendorFaultCreated", null);
exports.NotificationListener = NotificationListener = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        notifications_service_1.NotificationsService])
], NotificationListener);
//# sourceMappingURL=notification.listener.js.map