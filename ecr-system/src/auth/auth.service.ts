import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { LoginHistory } from '../users/login-history.entity';
import { Response } from 'express';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(LoginHistory) private loginHistoryRepo: Repository<LoginHistory>,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string, res: Response, ipAddress?: string, userAgent?: string) {
    // Accept login by email OR name field (username)
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :username OR user.name = :username', { username })
      .andWhere('user.isActive = :active', { active: true })
      .getOne();

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = this.jwtService.sign(payload);

    // Set JWT as HttpOnly cookie so frontend cookie-based auth works
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    });

    // Log the successful login silently
    const history = new LoginHistory();
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

  async getMe(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      username: user.name,
      role: user.role.toLowerCase(),
    };
  }

  logout(res: Response) {
    res.clearCookie('token');
    return { message: 'Logged out' };
  }
}
