"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefectReportsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const defect_report_entity_1 = require("./defect-report.entity");
const inspection_detail_entity_1 = require("../inspection/inspection-detail.entity");
const sm_review_entity_1 = require("../sm-review/sm-review.entity");
const gm_approval_entity_1 = require("../gm-approval/gm-approval.entity");
const audit_log_entity_1 = require("../audit-log/audit-log.entity");
const defect_reports_service_1 = require("./defect-reports.service");
const defect_reports_controller_1 = require("./defect-reports.controller");
const image_upload_module_1 = require("../image-upload/image-upload.module");
let DefectReportsModule = class DefectReportsModule {
};
exports.DefectReportsModule = DefectReportsModule;
exports.DefectReportsModule = DefectReportsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            image_upload_module_1.ImageUploadModule,
            typeorm_1.TypeOrmModule.forFeature([
                defect_report_entity_1.DefectReport,
                inspection_detail_entity_1.InspectionDetail,
                sm_review_entity_1.SmReview,
                gm_approval_entity_1.GmApproval,
                audit_log_entity_1.AuditLog,
            ]),
        ],
        controllers: [defect_reports_controller_1.DefectReportsController],
        providers: [defect_reports_service_1.DefectReportsService],
        exports: [defect_reports_service_1.DefectReportsService],
    })
], DefectReportsModule);
//# sourceMappingURL=defect-reports.module.js.map