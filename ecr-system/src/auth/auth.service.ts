import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { LoginHistory } from '../users/login-history.entity';
import { MonitoringService } from '../monitoring/monitoring.service';
import { Response } from 'express';
import { Role } from '../common/enums/role.enum';
import { EmailService } from '../email/services/email.service';
import { NotificationEvent } from '../email/enums/notification-event.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(LoginHistory) private loginHistoryRepo: Repository<LoginHistory>,
    private jwtService: JwtService,
    private monitoringService: MonitoringService,
    private configService: ConfigService,
    @Inject(forwardRef(() => EmailService))
    private emailService: EmailService,
  ) {}

  async login(username: string, password: string, res: Response, ipAddress?: string, userAgent?: string, portal?: string) {
    // Accept login by email OR name field (username)
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :username OR user.name = :username', { username })
      .andWhere('user.isActive = :active', { active: true })
      .getOne();

    if (!user) {
      this.monitoringService.recordLoginAttempt(false);
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      this.monitoringService.recordLoginAttempt(false);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Portal validation based on user role
    if (portal) {
      const portalLower = portal.toLowerCase();
      if (portalLower === 'admin' && user.role !== Role.ADMIN) {
        this.monitoringService.recordLoginAttempt(false);
        throw new UnauthorizedException('Access Denied: This portal is restricted to Administrators only.');
      }
      if (portalLower === 'user' && user.role === Role.ADMIN) {
        this.monitoringService.recordLoginAttempt(false);
        throw new UnauthorizedException('Access Denied: Administrators are not allowed to log in via the Staff Portal.');
      }
    }

    const payload = { sub: user.id, email: user.email, role: user.role.toUpperCase() };
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
    this.monitoringService.recordLoginAttempt(true);

    return {
      id: user.id,
      username: user.name,
      email: user.email,
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
      email: user.email,
      role: user.role.toLowerCase(),
    };
  }

  logout(res: Response) {
    res.clearCookie('token');
    return { message: 'Logged out' };
  }

  async forgotPassword(emailOrUsername: string, origin?: string) {
    if (!emailOrUsername || !emailOrUsername.trim()) {
      throw new BadRequestException('Please enter your email or username');
    }

    const trimmed = emailOrUsername.trim();
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:identifier) OR LOWER(user.name) = LOWER(:identifier)', { identifier: trimmed })
      .andWhere('user.isActive = :active', { active: true })
      .getOne();

    // If user not found, return generic success message to prevent user enumeration
    if (!user) {
      return {
        message: 'If an account exists with that email, a password reset link has been sent.',
      };
    }

    // Generate single-use reset token signed with JWT_SECRET + user.passwordHash
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'secret');
    const secret = jwtSecret + user.passwordHash;
    const resetToken = this.jwtService.sign(
      { sub: user.id, email: user.email, type: 'password_reset' },
      { secret, expiresIn: '1h' },
    );

    const baseUrl = origin || this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;

    // Queue password reset email
    await this.emailService.queueEmail({
      recipient: user.email,
      subject: 'Velan Quality Hub — Password Reset Request',
      event: NotificationEvent.REMINDER,
      templateName: 'password-reset',
      templateData: {
        employeeName: user.name,
        resetUrl,
        primaryButton: {
          text: 'Reset Password',
          url: resetUrl,
        },
      },
    });

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  async verifyResetToken(token: string) {
    if (!token) {
      throw new BadRequestException('Reset token is required');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.decode(token);
    } catch {
      throw new BadRequestException('Invalid reset token format');
    }

    if (!decoded || !decoded.sub || decoded.type !== 'password_reset') {
      throw new BadRequestException('Invalid reset token');
    }

    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: decoded.sub })
      .andWhere('user.isActive = :active', { active: true })
      .getOne();

    if (!user) {
      throw new BadRequestException('User not found or account deactivated');
    }

    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET', 'secret');
      const secret = jwtSecret + user.passwordHash;
      this.jwtService.verify(token, { secret });
    } catch {
      throw new BadRequestException('Password reset link is invalid or has expired.');
    }

    return { valid: true, email: user.email, name: user.name };
  }

  async resetPassword(token: string, newPassword: string) {
    if (!token) {
      throw new BadRequestException('Reset token is required');
    }
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters long');
    }

    const { valid } = await this.verifyResetToken(token);
    if (!valid) {
      throw new BadRequestException('Password reset link is invalid or has expired.');
    }

    const decoded: any = this.jwtService.decode(token);
    const user = await this.usersRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: decoded.sub })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await this.usersRepo.update(user.id, { passwordHash: newHash });

    return {
      message: 'Password has been successfully reset. You may now sign in with your new password.',
    };
  }
}
