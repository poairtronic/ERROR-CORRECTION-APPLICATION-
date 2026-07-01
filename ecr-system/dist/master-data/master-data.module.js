"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterDataModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const error_type_entity_1 = require("./error-types/error-type.entity");
const component_entity_1 = require("./components/component.entity");
const vendor_entity_1 = require("./vendors/vendor.entity");
const cost_rate_entity_1 = require("./cost-rates/cost-rate.entity");
const error_types_controller_1 = require("./error-types/error-types.controller");
const components_controller_1 = require("./components/components.controller");
const vendors_controller_1 = require("./vendors/vendors.controller");
const cost_rates_controller_1 = require("./cost-rates/cost-rates.controller");
let MasterDataModule = class MasterDataModule {
};
exports.MasterDataModule = MasterDataModule;
exports.MasterDataModule = MasterDataModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([error_type_entity_1.ErrorType, component_entity_1.Component, vendor_entity_1.Vendor, cost_rate_entity_1.CostRate])],
        controllers: [
            error_types_controller_1.ErrorTypesController,
            components_controller_1.ComponentsController,
            vendors_controller_1.VendorsController,
            cost_rates_controller_1.CostRatesController,
        ],
    })
], MasterDataModule);
//# sourceMappingURL=master-data.module.js.map