import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-internal-secret'];
    if (!secret || secret !== process.env.ECR_INTERNAL_SECRET) {
      throw new UnauthorizedException('Invalid or missing internal secret');
    }
    return true;
  }
}
