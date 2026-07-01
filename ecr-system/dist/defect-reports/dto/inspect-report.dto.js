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
exports.InspectReportDto = void 0;
const class_validator_1 = require("class-validator");
const report_status_enum_1 = require("../../common/enums/report-status.enum");
class InspectReportDto {
}
exports.InspectReportDto = InspectReportDto;
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InspectReportDto.prototype, "errorType", void 0);
__decorate([
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], InspectReportDto.prototype, "rootCause", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(report_status_enum_1.ResponsibleParty),
    __metadata("design:type", String)
], InspectReportDto.prototype, "responsibleParty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InspectReportDto.prototype, "responsibleId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(report_status_enum_1.Decision),
    __metadata("design:type", String)
], InspectReportDto.prototype, "decision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], InspectReportDto.prototype, "alternativeNote", void 0);
//# sourceMappingURL=inspect-report.dto.js.map