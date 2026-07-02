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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("./user.entity");
let UsersService = class UsersService {
    constructor(repo) {
        this.repo = repo;
    }
    findAll(role, department) {
        const where = {};
        if (role)
            where.role = role;
        if (department)
            where.department = department;
        return this.repo.find({ where, order: { name: 'ASC' } });
    }
    async findOne(id) {
        const user = await this.repo.findOne({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    findByEmail(email) {
        return this.repo.findOne({ where: { email } });
    }
    async create(dto) {
        const existing = await this.findByEmail(dto.email);
        if (existing) {
            throw new common_1.ConflictException('A user with this email already exists.');
        }
        const passwordHash = await bcrypt.hash(dto.tempPassword, 10);
        const user = this.repo.create({
            name: dto.name,
            email: dto.email,
            role: dto.role,
            department: dto.department,
            salaryRefId: dto.salaryRefId,
            passwordHash,
        });
        return this.repo.save(user);
    }
    async update(id, dto) {
        const user = await this.findOne(id);
        Object.assign(user, dto);
        return this.repo.save(user);
    }
    async deactivate(id) {
        const user = await this.findOne(id);
        user.isActive = false;
        return this.repo.save(user);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map