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
exports.DefectReportsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const defect_reports_service_1 = require("./defect-reports.service");
const create_defect_report_dto_1 = require("./dto/create-defect-report.dto");
const inspect_report_dto_1 = require("./dto/inspect-report.dto");
const sm_review_dto_1 = require("./dto/sm-review.dto");
const gm_approve_dto_1 = require("./dto/gm-approve.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const role_enum_1 = require("../common/enums/role.enum");
let DefectReportsController = class DefectReportsController {
    constructor(service) {
        this.service = service;
    }
    create(dto, user) {
        return this.service.create(dto, user);
    }
    findAll(status, mine, user) {
        return this.service.findAll({
            status,
            raisedById: mine === 'true' ? user?.id : undefined,
        });
    }
    findOne(id) {
        return this.service.findOne(id);
    }
    inspect(id, dto, user) {
        return this.service.inspect(id, dto, user);
    }
    smReview(id, dto, user) {
        return this.service.smReview(id, dto, user);
    }
    gmApprove(id, dto, user) {
        return this.service.gmApprove(id, dto, user);
    }
    editField(id, body, user) {
        return this.service.editField(id, body.field, body.value, user);
    }
    async uploadImages(id, files, user) {
        return this.service.uploadImages(id, files, user);
    }
    async deleteImage(id, body, user) {
        return this.service.deleteImage(id, body.imageUrl, user);
    }
    async transitionStatus(id, body, user) {
        return this.service.transitionStatus(id, body.status, body.note, user);
    }
    async issueComponents(id, body, user) {
        return this.service.issueComponents(id, body, user);
    }
};
exports.DefectReportsController = DefectReportsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.OPERATOR, role_enum_1.Role.INSPECTOR, role_enum_1.Role.SENIOR_MANAGER),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_defect_report_dto_1.CreateDefectReportDto, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('status')),
    __param(1, (0, common_1.Query)('mine')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id/inspect'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.INSPECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, inspect_report_dto_1.InspectReportDto, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "inspect", null);
__decorate([
    (0, common_1.Patch)(':id/sm-review'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, sm_review_dto_1.SmReviewDto, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "smReview", null);
__decorate([
    (0, common_1.Patch)(':id/gm-approve'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, gm_approve_dto_1.GmApproveDto, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "gmApprove", null);
__decorate([
    (0, common_1.Patch)(':id/field'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], DefectReportsController.prototype, "editField", null);
__decorate([
    (0, common_1.Post)(':id/images'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.OPERATOR, role_enum_1.Role.INSPECTOR, role_enum_1.Role.SENIOR_MANAGER),
    (0, common_1.UseInterceptors)((0, platform_express_1.FilesInterceptor)('files', 5)),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.UploadedFiles)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Array, Object]),
    __metadata("design:returntype", Promise)
], DefectReportsController.prototype, "uploadImages", null);
__decorate([
    (0, common_1.Delete)(':id/images'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.OPERATOR, role_enum_1.Role.INSPECTOR, role_enum_1.Role.SENIOR_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DefectReportsController.prototype, "deleteImage", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DefectReportsController.prototype, "transitionStatus", null);
__decorate([
    (0, common_1.Patch)(':id/issue-components'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.STORE_MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DefectReportsController.prototype, "issueComponents", null);
exports.DefectReportsController = DefectReportsController = __decorate([
    (0, common_1.Controller)('defect-reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [defect_reports_service_1.DefectReportsService])
], DefectReportsController);
//# sourceMappingURL=defect-reports.controller.js.map