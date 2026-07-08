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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const user_entity_1 = require("../users/user.entity");
const login_history_entity_1 = require("../users/login-history.entity");
let AuthService = class AuthService {
    constructor(usersRepo, loginHistoryRepo, jwtService) {
        this.usersRepo = usersRepo;
        this.loginHistoryRepo = loginHistoryRepo;
        this.jwtService = jwtService;
    }
    async login(username, password, res, ipAddress, userAgent) {
        const user = await this.usersRepo
            .createQueryBuilder('user')
            .addSelect('user.passwordHash')
            .where('user.email = :username OR user.name = :username', { username })
            .andWhere('user.isActive = :active', { active: true })
            .getOne();
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const payload = { sub: user.id, email: user.email, role: user.role };
        const token = this.jwtService.sign(payload);
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000,
        });
        const history = new login_history_entity_1.LoginHistory();
        history.userId = user.id;
        history.ipAddress = ipAddress || '';
        history.userAgent = userAgent || '';
        this.loginHistoryRepo.save(history).catch(err => console.error('Failed to log login history:', err));
        return {
            id: user.id,
            username: user.name,
            role: user.role.toLowerCase(),
            accessToken: token,
        };
    }
    async getMe(userId) {
        const user = await this.usersRepo.findOne({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        return {
            id: user.id,
            username: user.name,
            role: user.role.toLowerCase(),
        };
    }
    logout(res) {
        res.clearCookie('token');
        return { message: 'Logged out' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __param(1, (0, typeorm_1.InjectRepository)(login_history_entity_1.LoginHistory)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map