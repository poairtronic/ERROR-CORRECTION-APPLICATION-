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
exports.ComponentIssueController = void 0;
const common_1 = require("@nestjs/common");
const component_issue_service_1 = require("./component-issue.service");
const create_component_issue_dto_1 = require("./dto/create-component-issue.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const role_enum_1 = require("../common/enums/role.enum");
let ComponentIssueController = class ComponentIssueController {
    constructor(componentIssueService) {
        this.componentIssueService = componentIssueService;
    }
    async issueComponents(req, dto) {
        const storeManagerId = req.user.id;
        return this.componentIssueService.issueComponents(storeManagerId, dto);
    }
    async getIssuesByReport(reportId) {
        return this.componentIssueService.getIssuesByReport(reportId);
    }
};
exports.ComponentIssueController = ComponentIssueController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.STORE_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_component_issue_dto_1.CreateComponentIssueDto]),
    __metadata("design:returntype", Promise)
], ComponentIssueController.prototype, "issueComponents", null);
__decorate([
    (0, common_1.Get)('report/:reportId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.STORE_MANAGER, role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.INSPECTOR),
    __param(0, (0, common_1.Param)('reportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ComponentIssueController.prototype, "getIssuesByReport", null);
exports.ComponentIssueController = ComponentIssueController = __decorate([
    (0, common_1.Controller)('component-issue'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [component_issue_service_1.ComponentIssueService])
], ComponentIssueController);
//# sourceMappingURL=component-issue.controller.js.map