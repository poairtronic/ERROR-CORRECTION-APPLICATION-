import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
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
    // returned object becomes request.user
    // Normalize role to uppercase to match Role enum values (e.g., 'INSPECTOR', 'OPERATOR')
    // This prevents 403 errors when the DB/JWT stores mixed-case roles like 'Inspector'
    const normalizedRole = payload.role ? payload.role.toUpperCase() : payload.role;
    return { sub: payload.sub, id: payload.sub, email: payload.email, role: normalizedRole };
  }
}
