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
exports.ComponentsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const component_entity_1 = require("./component.entity");
const base_crud_controller_1 = require("../../common/controllers/base-crud.controller");
let ComponentsController = class ComponentsController extends base_crud_controller_1.BaseCrudController {
    constructor(repo) {
        super(repo);
    }
};
exports.ComponentsController = ComponentsController;
exports.ComponentsController = ComponentsController = __decorate([
    (0, common_1.Controller)('master-data/components'),
    __param(0, (0, typeorm_1.InjectRepository)(component_entity_1.Component)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ComponentsController);
//# sourceMappingURL=components.controller.js.map