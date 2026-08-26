import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) { return this.authService.register(dto); }
  @Post('login')
  login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('google')
  googleLogin(@Body() body: { credential: string; client_id?: string; nonce?: string }, @Headers('origin') origin?: string) {
    return this.authService.googleLogin(body?.credential, origin, body?.client_id, body?.nonce);
  }

  @UseGuards(JwtAuthGuard)
  @Get('authenticator/status')
  authenticatorStatus(@Req() req: any) {
    return this.authService.authenticatorStatus(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/setup')
  authenticatorSetup(@Req() req: any) {
    return this.authService.authenticatorSetup(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/verify')
  authenticatorVerify(@Req() req: any, @Body() body: { code: string }) {
    return this.authService.authenticatorVerify(req.user, body?.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/disable')
  authenticatorDisable(@Req() req: any, @Body() body: { code: string }) {
    return this.authService.authenticatorDisable(req.user, body?.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/options')
  passkeyRegisterOptions(@Req() req: any, @Headers('origin') origin?: string) {
    return this.authService.passkeyRegisterOptions(req.user, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/verify')
  passkeyRegisterVerify(@Req() req: any, @Body() body: any, @Headers('origin') origin?: string) {
    return this.authService.passkeyRegisterVerify(req.user, body, origin);
  }

  @Post('passkey/login/options')
  passkeyLoginOptions(@Body() body: { email: string }, @Headers('origin') origin?: string) {
    return this.authService.passkeyLoginOptions(body.email, origin);
  }

  @Post('passkey/login/verify')
  passkeyLoginVerify(@Body() body: any, @Headers('origin') origin?: string) {
    return this.authService.passkeyLoginVerify(body, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: any) { return req.user; }
}
