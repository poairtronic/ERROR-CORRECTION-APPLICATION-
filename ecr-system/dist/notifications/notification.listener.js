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
var NotificationListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
const defect_report_entity_1 = require("../defect-reports/defect-report.entity");
const role_enum_1 = require("../common/enums/role.enum");
const report_status_enum_1 = require("../common/enums/report-status.enum");
const notifications_service_1 = require("./notifications.service");
const email_service_1 = require("../email/services/email.service");
const notification_event_enum_1 = require("../email/enums/notification-event.enum");
let NotificationListener = NotificationListener_1 = class NotificationListener {
    constructor(usersRepo, reportsRepo, notificationsService, emailService) {
        this.usersRepo = usersRepo;
        this.reportsRepo = reportsRepo;
        this.notificationsService = notificationsService;
        this.emailService = emailService;
        this.logger = new common_1.Logger(NotificationListener_1.name);
    }
    async fetchReportWithRelations(reportId) {
        return this.reportsRepo.findOne({
            where: { id: reportId },
            relations: ['raisedBy', 'inspectionDetail', 'smReview', 'gmApproval'],
        });
    }
    async handleStatusChanged(event) {
        const report = await this.fetchReportWithRelations(event.reportId);
        if (!report)
            return;
        switch (event.status) {
            case report_status_enum_1.ReportStatus.PENDING_SM_REVIEW:
                await this.handlePendingSmReview(report);
                break;
            case report_status_enum_1.ReportStatus.PENDING_GM_APPROVAL:
                await this.handlePendingGmApproval(report);
                break;
            case report_status_enum_1.ReportStatus.APPROVED:
                await this.handleApproved(report);
                break;
            case report_status_enum_1.ReportStatus.REJECTED:
                await this.handleRejected(report);
                break;
            default:
                break;
        }
    }
    async handlePendingSmReview(report) {
        const smUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.SENIOR_MANAGER, isActive: true } });
        const inspector = report.inspectionDetail?.inspectorId
            ? await this.usersRepo.findOne({ where: { id: report.inspectionDetail.inspectorId } })
            : report.raisedBy;
        const summaryTable = {
            'Report Number': report.reportNo,
            'Product': report.productId,
            'Component': report.componentName,
            'Error Type': report.inspectionDetail?.errorType || report.errorTypeName,
            'Responsible Party': report.inspectionDetail?.responsibleParty || 'N/A',
            'Estimated Cost': report.inspectionDetail?.costEstimate?.toString() || 'N/A',
            'Estimated Time': report.inspectionDetail?.timeEstimateHours?.toString() || 'N/A',
            'Inspector': inspector?.name || 'Unknown',
            'Submission Time': report.createdAt.toISOString(),
        };
        for (const sm of smUsers) {
            await this.emailService.queueEmail({
                recipient: sm.email,
                subject: 'New ECR Pending Review',
                event: notification_event_enum_1.NotificationEvent.REPORT_UPDATED,
                relatedReportId: report.id,
                templateData: {
                    title: 'New Defect Report Pending Your Review',
                    message: 'A new Defect Report has been submitted by an Inspector and requires your review.',
                    summaryTable,
                    primaryButton: {
                        text: 'Open Report',
                        url: `http://localhost:5173/reports/${report.id}`,
                    },
                },
            });
        }
    }
    async handlePendingGmApproval(report) {
        const gmUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.GENERAL_MANAGER, isActive: true } });
        const summaryTable = {
            'Report Number': report.reportNo,
            'Inspector Summary': report.inspectionDetail?.errorType || 'N/A',
            'Estimated Cost': report.inspectionDetail?.costEstimate?.toString() || 'N/A',
            'Estimated Time': report.inspectionDetail?.timeEstimateHours?.toString() || 'N/A',
            'Remarks': report.inspectionDetail?.alternativeNote || 'None',
            'SM Notes': report.smReview?.decisionNote || 'None',
        };
        for (const gm of gmUsers) {
            await this.emailService.queueEmail({
                recipient: gm.email,
                subject: 'Pending GM Approval',
                event: notification_event_enum_1.NotificationEvent.REPORT_UPDATED,
                relatedReportId: report.id,
                templateData: {
                    title: 'Report Pending Final Approval',
                    message: 'The Senior Manager has approved this report and forwarded it for your final decision.',
                    summaryTable,
                    primaryButton: {
                        text: 'Open Report',
                        url: `http://localhost:5173/reports/${report.id}`,
                    },
                },
            });
        }
    }
    async handleApproved(report) {
        const salesUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.SALES, isActive: true } });
        const storeUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.STORE_MANAGER, isActive: true } });
        const salesSummary = {
            'Report Number': report.reportNo,
            'Budget': report.gmApproval?.budgetApproved?.toString() || 'N/A',
            'Customer Impact': report.inspectionDetail?.timeEstimateHours ? 'Potential Delay' : 'Minimal',
            'Remarks': report.gmApproval?.remarks || 'None',
        };
        for (const sales of salesUsers) {
            await this.emailService.queueEmail({
                recipient: sales.email,
                subject: `Approved Report: ${report.reportNo}`,
                event: notification_event_enum_1.NotificationEvent.REPORT_APPROVED,
                relatedReportId: report.id,
                templateData: {
                    title: 'Defect Report Approved',
                    message: 'A defect report has been fully approved by the General Manager.',
                    summaryTable: salesSummary,
                    primaryButton: {
                        text: 'View Details',
                        url: `http://localhost:5173/reports/${report.id}`,
                    },
                },
            });
        }
        const storesSummary = {
            'Report Number': report.reportNo,
            'Component Details': report.componentName,
            'Required Action': 'Prepare replacement components',
            'Rework Information': report.defectDescription,
        };
        for (const store of storeUsers) {
            await this.emailService.queueEmail({
                recipient: store.email,
                subject: `Action Required - Approved Report: ${report.reportNo}`,
                event: notification_event_enum_1.NotificationEvent.REPORT_APPROVED,
                relatedReportId: report.id,
                templateData: {
                    title: 'Component Issue Request',
                    message: 'A defect report has been approved and requires components to be issued.',
                    summaryTable: storesSummary,
                    primaryButton: {
                        text: 'Issue Components',
                        url: `http://localhost:5173/reports/${report.id}`,
                    },
                },
            });
        }
    }
    async handleRejected(report) {
        if (report.gmApproval && report.gmApproval.approved === false) {
            const smId = report.smReview?.smId;
            const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;
            const notifyIds = new Set();
            if (smId)
                notifyIds.add(smId);
            if (inspectorId)
                notifyIds.add(inspectorId);
            const usersToNotify = await this.usersRepo.find({
                where: Array.from(notifyIds).map(id => ({ id })),
            });
            const summaryTable = {
                'Report Number': report.reportNo,
                'Reason': report.gmApproval.remarks || 'No remarks provided',
                'Remarks': 'Rejected by General Manager',
                'Action Required': 'Review rejection and take corrective action if needed.',
            };
            for (const user of usersToNotify) {
                await this.emailService.queueEmail({
                    recipient: user.email,
                    subject: `Report Rejected: ${report.reportNo}`,
                    event: notification_event_enum_1.NotificationEvent.REPORT_REJECTED,
                    relatedReportId: report.id,
                    templateData: {
                        title: 'Report Rejected',
                        message: 'Your report was rejected during the final approval stage.',
                        summaryTable,
                        primaryButton: {
                            text: 'View Report',
                            url: `http://localhost:5173/reports/${report.id}`,
                        },
                    },
                });
            }
        }
        else if (report.smReview && report.smReview.forwardedToGm === false) {
            const inspectorId = report.inspectionDetail?.inspectorId || report.raisedById;
            const inspector = await this.usersRepo.findOne({ where: { id: inspectorId } });
            if (inspector) {
                await this.emailService.queueEmail({
                    recipient: inspector.email,
                    subject: `Report Rejected: ${report.reportNo}`,
                    event: notification_event_enum_1.NotificationEvent.REPORT_REJECTED,
                    relatedReportId: report.id,
                    templateData: {
                        title: 'Report Rejected',
                        message: 'Your report was rejected during Senior Manager review.',
                        summaryTable: {
                            'Report Number': report.reportNo,
                            'Reason': report.smReview.decisionNote || 'No reason provided',
                            'Remarks': 'Please check the report for details.',
                        },
                        primaryButton: {
                            text: 'View Report',
                            url: `http://localhost:5173/reports/${report.id}`,
                        },
                    },
                });
            }
        }
    }
    async handleComponentIssued(payload) {
        const user = await this.usersRepo.findOne({ where: { id: payload.issuedToId } });
        if (!user)
            return;
        const report = await this.fetchReportWithRelations(payload.reportId);
        await this.emailService.queueEmail({
            recipient: user.email,
            subject: 'Components Issued',
            event: notification_event_enum_1.NotificationEvent.COMPONENT_ISSUED,
            relatedReportId: payload.reportId,
            templateData: {
                title: 'Components Issued for Report',
                message: `Components have been issued to you for Defect Report ${report?.reportNo || payload.reportId}.`,
                summaryTable: {
                    'Issued Components': 'See system for details',
                    'Store Manager': 'N/A',
                    'Issue Time': new Date().toISOString(),
                },
                primaryButton: {
                    text: 'View Details',
                    url: `http://localhost:5173/reports/${payload.reportId}`,
                },
            },
        });
    }
    async handleSalaryDeductionCreated(payload) {
        const adminUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.ADMIN, isActive: true } });
        for (const admin of adminUsers) {
            await this.emailService.queueEmail({
                recipient: admin.email,
                subject: 'New Salary Deduction Logged',
                event: notification_event_enum_1.NotificationEvent.SALARY_DEDUCTION,
                relatedReportId: payload.deductionId,
                templateData: {
                    title: 'Salary Deduction Record',
                    message: 'A new salary deduction has been recorded in the system.',
                    summaryTable: {
                        'Deduction ID': payload.deductionId,
                        'Operator ID': payload.operatorId,
                        'Amount': payload.amount.toString(),
                    },
                },
            });
        }
    }
    async handleVendorFaultCreated(payload) {
        const adminUsers = await this.usersRepo.find({ where: { role: role_enum_1.Role.ADMIN, isActive: true } });
        const report = await this.fetchReportWithRelations(payload.reportId);
        for (const admin of adminUsers) {
            await this.emailService.queueEmail({
                recipient: admin.email,
                subject: `Vendor Fault Logged: ${report?.reportNo || payload.reportId}`,
                event: notification_event_enum_1.NotificationEvent.VENDOR_FAULT,
                relatedReportId: payload.reportId,
                templateData: {
                    title: 'Vendor Fault Recorded',
                    message: 'A vendor fault has been formally recorded and requires attention.',
                    summaryTable: {
                        'Fault ID': payload.faultId,
                        'Vendor ID': payload.vendorId,
                        'Report Number': report?.reportNo || payload.reportId,
                    },
                    primaryButton: {
                        text: 'View Report',
                        url: `http://localhost:5173/reports/${payload.reportId}`,
                    },
                },
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
exports.NotificationListener = NotificationListener = NotificationListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(defect_report_entity_1.DefectReport)),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => email_service_1.EmailService))),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        notifications_service_1.NotificationsService,
        email_service_1.EmailService])
], NotificationListener);
//# sourceMappingURL=notification.listener.js.map