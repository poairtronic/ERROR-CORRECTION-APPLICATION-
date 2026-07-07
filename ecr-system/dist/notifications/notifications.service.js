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
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const config_1 = require("@nestjs/config");
const notification_entity_1 = require("./notification.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const email_service_1 = require("../email/services/email.service");
const notifications_gateway_1 = require("./notifications.gateway");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(repo, config, emailService, gateway) {
        this.repo = repo;
        this.config = config;
        this.emailService = emailService;
        this.gateway = gateway;
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    async create(params) {
        const notification = await this.repo.save(this.repo.create({
            userId: params.userId,
            reportId: params.reportId,
            channel: params.channel,
            type: params.type,
            message: params.message,
            status: report_status_enum_1.NotificationStatus.QUEUED,
            attemptCount: 1,
        }));
        try {
            await this.gateway.pushToUser(params.userId, {
                id: notification.id,
                type: params.event,
                title: params.subject,
                message: params.message,
                reportId: params.reportId,
            });
            notification.status = report_status_enum_1.NotificationStatus.SENT;
            notification.sentAt = new Date();
            await this.repo.save(notification);
        }
        catch (err) {
            this.logger.warn(`Failed to emit websocket notification: ${err.message}`);
        }
        if (params.channel === report_status_enum_1.NotificationChannel.EMAIL || params.channel === report_status_enum_1.NotificationChannel.APP_AND_EMAIL) {
            await this.emailService.queueEmail({
                notificationId: notification.id,
                recipient: params.userEmail,
                subject: params.subject,
                event: params.event,
                templateData: params.templateData,
                relatedReportId: params.reportId,
            });
        }
        return notification;
    }
    async retryFailed(maxAttempts = 3) {
        return { retried: 0 };
    }
    findForUser(userId, unreadOnly = false) {
        const where = { userId };
        if (unreadOnly)
            where.read = false;
        return this.repo.find({ where, order: { createdAt: 'DESC' }, relations: ['report'] });
    }
    findByReport(reportId) {
        return this.repo.find({ where: { reportId }, order: { createdAt: 'ASC' } });
    }
    async markRead(id) {
        await this.repo.update(id, { read: true });
    }
    async markDelivered(id) {
        await this.repo.update(id, { status: report_status_enum_1.NotificationStatus.DELIVERED });
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(2, (0, common_1.Inject)((0, common_1.forwardRef)(() => email_service_1.EmailService))),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_gateway_1.NotificationsGateway))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService,
        email_service_1.EmailService,
        notifications_gateway_1.NotificationsGateway])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map