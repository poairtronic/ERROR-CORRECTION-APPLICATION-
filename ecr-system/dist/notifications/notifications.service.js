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
const nodemailer = require("nodemailer");
const notification_entity_1 = require("./notification.entity");
const report_status_enum_1 = require("../common/enums/report-status.enum");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(repo, config) {
        this.repo = repo;
        this.config = config;
        this.logger = new common_1.Logger(NotificationsService_1.name);
        this.transporter = nodemailer.createTransport({
            host: this.config.get('SMTP_HOST'),
            port: Number(this.config.get('SMTP_PORT')),
            auth: {
                user: this.config.get('SMTP_USER'),
                pass: this.config.get('SMTP_PASS'),
            },
        });
    }
    async send(params) {
        const notification = await this.repo.save(this.repo.create({
            userId: params.userId,
            reportId: params.reportId,
            channel: params.channel,
            type: params.type,
            message: params.message,
        }));
        await this.attemptDelivery(notification, params.userEmail);
        return notification;
    }
    async attemptDelivery(notification, email) {
        try {
            if (notification.channel === report_status_enum_1.NotificationChannel.EMAIL && email) {
                await this.transporter.sendMail({
                    from: this.config.get('EMAIL_FROM'),
                    to: email,
                    subject: `ECR Notification: ${notification.type}`,
                    text: notification.message,
                });
            }
            notification.status = report_status_enum_1.NotificationStatus.SENT;
            notification.sentAt = new Date();
        }
        catch (err) {
            this.logger.warn(`Notification ${notification.id} delivery failed: ${err.message}`);
            notification.status = report_status_enum_1.NotificationStatus.FAILED;
        }
        notification.attemptCount += 1;
        await this.repo.save(notification);
    }
    async retryFailed(maxAttempts = 3) {
        const failed = await this.repo.find({
            where: { status: report_status_enum_1.NotificationStatus.FAILED },
            relations: ['user'],
            take: 50,
        });
        for (const n of failed) {
            if (n.attemptCount >= maxAttempts)
                continue;
            await this.attemptDelivery(n, n.user?.email);
        }
        return { retried: failed.length };
    }
    findForUser(userId, unreadOnly = false) {
        const where = { userId };
        if (unreadOnly)
            where.read = false;
        return this.repo.find({ where, order: { createdAt: 'DESC' } });
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
    __metadata("design:paramtypes", [typeorm_2.Repository,
        config_1.ConfigService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map