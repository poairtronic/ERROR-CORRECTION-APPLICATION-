import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {
    super({
      // Extract JWT from cookie first, then fall back to Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: JwtPayload) {
    // Fetch the user from the DB to ensure they are still active and get their latest role
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } }).catch(() => null);
    if (!user || !user.isActive) {
      return null; // Triggers 401 Unauthorized if user doesn't exist or is deactivated
    }
    return { sub: user.id, id: user.id, email: user.email, role: user.role.toUpperCase() };
  }
}
