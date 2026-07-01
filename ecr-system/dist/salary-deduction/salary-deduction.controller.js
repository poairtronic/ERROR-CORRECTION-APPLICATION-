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
exports.SalaryDeductionController = void 0;
const common_1 = require("@nestjs/common");
const salary_deduction_service_1 = require("./salary-deduction.service");
const salary_deduction_dto_1 = require("./dto/salary-deduction.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const role_enum_1 = require("../common/enums/role.enum");
let SalaryDeductionController = class SalaryDeductionController {
    constructor(deductionService) {
        this.deductionService = deductionService;
    }
    async create(req, dto) {
        return this.deductionService.create(dto, req.user.id, req.user.role);
    }
    async updateStatus(req, id, dto) {
        return this.deductionService.updateStatus(id, dto, req.user.id, req.user.role);
    }
    async getByReport(reportId) {
        return this.deductionService.getByReport(reportId);
    }
    async getByOperator(operatorId) {
        return this.deductionService.getByOperator(operatorId);
    }
};
exports.SalaryDeductionController = SalaryDeductionController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, salary_deduction_dto_1.CreateSalaryDeductionDto]),
    __metadata("design:returntype", Promise)
], SalaryDeductionController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN, role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, salary_deduction_dto_1.UpdateSalaryDeductionStatusDto]),
    __metadata("design:returntype", Promise)
], SalaryDeductionController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Get)('report/:reportId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.ADMIN, role_enum_1.Role.INSPECTOR),
    __param(0, (0, common_1.Param)('reportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SalaryDeductionController.prototype, "getByReport", null);
__decorate([
    (0, common_1.Get)('operator/:operatorId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.ADMIN, role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Param)('operatorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SalaryDeductionController.prototype, "getByOperator", null);
exports.SalaryDeductionController = SalaryDeductionController = __decorate([
    (0, common_1.Controller)('salary-deduction'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [salary_deduction_service_1.SalaryDeductionService])
], SalaryDeductionController);
//# sourceMappingURL=salary-deduction.controller.js.map