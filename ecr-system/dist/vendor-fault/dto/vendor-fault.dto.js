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
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateVendorFaultDto = exports.CreateVendorFaultDto = void 0;
const class_validator_1 = require("class-validator");
const report_status_enum_1 = require("../../common/enums/report-status.enum");
class CreateVendorFaultDto {
}
exports.CreateVendorFaultDto = CreateVendorFaultDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateVendorFaultDto.prototype, "reportId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateVendorFaultDto.prototype, "vendorId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateVendorFaultDto.prototype, "note", void 0);
class UpdateVendorFaultDto {
}
exports.UpdateVendorFaultDto = UpdateVendorFaultDto;
__decorate([
    (0, class_validator_1.IsEnum)(report_status_enum_1.RecoveryStatus),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateVendorFaultDto.prototype, "recoveryStatus", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], UpdateVendorFaultDto.prototype, "recoveryAmount", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateVendorFaultDto.prototype, "note", void 0);
//# sourceMappingURL=vendor-fault.dto.js.map