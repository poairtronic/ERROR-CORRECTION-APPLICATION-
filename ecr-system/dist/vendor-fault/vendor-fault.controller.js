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
exports.VendorFaultController = void 0;
const common_1 = require("@nestjs/common");
const vendor_fault_service_1 = require("./vendor-fault.service");
const vendor_fault_dto_1 = require("./dto/vendor-fault.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const role_enum_1 = require("../common/enums/role.enum");
let VendorFaultController = class VendorFaultController {
    constructor(faultService) {
        this.faultService = faultService;
    }
    async create(req, dto) {
        return this.faultService.create(dto, req.user.id, req.user.role);
    }
    async update(req, id, dto) {
        return this.faultService.update(id, dto, req.user.id, req.user.role);
    }
    async getByReport(reportId) {
        return this.faultService.getByReport(reportId);
    }
    async getByVendor(vendorId) {
        return this.faultService.getByVendor(vendorId);
    }
};
exports.VendorFaultController = VendorFaultController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, vendor_fault_dto_1.CreateVendorFaultDto]),
    __metadata("design:returntype", Promise)
], VendorFaultController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.ADMIN),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, vendor_fault_dto_1.UpdateVendorFaultDto]),
    __metadata("design:returntype", Promise)
], VendorFaultController.prototype, "update", null);
__decorate([
    (0, common_1.Get)('report/:reportId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.ADMIN, role_enum_1.Role.INSPECTOR),
    __param(0, (0, common_1.Param)('reportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorFaultController.prototype, "getByReport", null);
__decorate([
    (0, common_1.Get)('vendor/:vendorId'),
    (0, roles_decorator_1.Roles)(role_enum_1.Role.SENIOR_MANAGER, role_enum_1.Role.GENERAL_MANAGER, role_enum_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('vendorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VendorFaultController.prototype, "getByVendor", null);
exports.VendorFaultController = VendorFaultController = __decorate([
    (0, common_1.Controller)('vendor-fault'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [vendor_fault_service_1.VendorFaultService])
], VendorFaultController);
//# sourceMappingURL=vendor-fault.controller.js.map