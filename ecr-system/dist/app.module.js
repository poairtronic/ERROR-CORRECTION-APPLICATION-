"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const event_emitter_1 = require("@nestjs/event-emitter");
const schedule_1 = require("@nestjs/schedule");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const defect_reports_module_1 = require("./defect-reports/defect-reports.module");
const notifications_module_1 = require("./notifications/notifications.module");
const master_data_module_1 = require("./master-data/master-data.module");
const component_issue_module_1 = require("./component-issue/component-issue.module");
const vendor_fault_module_1 = require("./vendor-fault/vendor-fault.module");
const salary_deduction_module_1 = require("./salary-deduction/salary-deduction.module");
const image_upload_module_1 = require("./image-upload/image-upload.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            event_emitter_1.EventEmitterModule.forRoot(),
            schedule_1.ScheduleModule.forRoot(),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: (config) => ({
                    type: 'postgres',
                    url: config.get('DATABASE_URL'),
                    autoLoadEntities: true,
                    synchronize: config.get('NODE_ENV') !== 'production',
                    ssl: { rejectUnauthorized: false },
                }),
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            defect_reports_module_1.DefectReportsModule,
            notifications_module_1.NotificationsModule,
            master_data_module_1.MasterDataModule,
            component_issue_module_1.ComponentIssueModule,
            vendor_fault_module_1.VendorFaultModule,
            salary_deduction_module_1.SalaryDeductionModule,
            image_upload_module_1.ImageUploadModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map