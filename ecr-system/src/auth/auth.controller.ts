import { Body, Controller, Post, Get, HttpCode, Res, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  @HttpCode(200)
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    return this.authService.login(body.username, body.password, res, req.ip, req.headers['user-agent'], body.portal);
  }

  @Post('forgot-password')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) {
    const rawOrigin = req.headers.origin || req.headers.referer;
    let origin: string | undefined;
    if (rawOrigin) {
      try {
        origin = new URL(rawOrigin as string).origin;
      } catch {
        origin = undefined;
      }
    }
    return this.authService.forgotPassword(body.email, origin);
  }

  @Post('verify-reset-token')
  @HttpCode(200)
  verifyResetToken(@Body() body: VerifyResetTokenDto) {
    return this.authService.verifyResetToken(body.token);
  }

  @Post('reset-password')
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @HttpCode(200)
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: Request & { user: any }) {
    return this.authService.getMe(req.user.sub);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    return this.authService.logout(res);
  }
}
