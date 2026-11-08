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
import { TwoFactorService } from './two-factor.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto, @Req() req: any) {
    await this.authService.consumeAuthEndpointRateLimit('register', req?.ip);
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any) { return this.authService.login(dto, req?.ip); }

  @Get('google/config')
  googleConfig() { return this.authService.googleConfig(); }

  @Post('google')
  async googleLogin(@Body() body: { credential: string; client_id?: string; nonce?: string; loginMode?: string }, @Headers('origin') origin?: string, @Req() req?: any) {
    await this.authService.consumeAuthEndpointRateLimit('google-login', req?.ip, body?.loginMode || '');
    return this.authService.googleLogin(body?.credential, origin, body?.client_id, body?.nonce, body?.loginMode);
  }

  @Post('google/android')
  async googleAndroidLogin(@Body() body: { credential: string; loginMode?: string }, @Req() req: any) {
    await this.authService.consumeAuthEndpointRateLimit('google-android-login', req?.ip, body?.loginMode || '');
    return this.authService.googleLogin(body?.credential, 'android-app', undefined, undefined, body?.loginMode);
  }

  @Post('2fa/verify')
  async verifyTwoFactor(@Body() body: { token: string; code?: string; recoveryCode?: string }, @Req() req: any) {
    await this.authService.consumeAuthEndpointRateLimit('two-factor-verify', req?.ip);
    return this.twoFactorService.verify(body?.token, body?.code, body?.recoveryCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get('authenticator/status')
  authenticatorStatus(@Req() req: any) {
    return this.authService.authenticatorStatus(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/setup')
  authenticatorSetup(@Req() req: any, @Body() body: { password: string }) {
    return this.authService.authenticatorSetup(req.user, body?.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/verify')
  authenticatorVerify(@Req() req: any, @Body() body: { code: string }) {
    return this.authService.authenticatorVerify(req.user, body?.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('authenticator/disable')
  authenticatorDisable(@Req() req: any, @Body() body: { password: string; code: string }) {
    return this.authService.authenticatorDisable(req.user, body?.password, body?.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/unregister-all')
  async passkeyUnregisterAll(@Req() req: any, @Body() body: { password: string; code?: string }) {
    await this.authService.reauthenticateSecurityAction(req.user, body?.password, body?.code);
    return this.authService.passkeyUnregisterAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/options')
  async passkeyRegisterOptions(@Req() req: any, @Body() body: { replaceExisting?: boolean; password: string; code?: string }, @Headers('origin') origin?: string) {
    await this.authService.reauthenticateSecurityAction(req.user, body?.password, body?.code);
    return this.authService.passkeyRegisterOptions(req.user, origin, !!body?.replaceExisting);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/verify')
  passkeyRegisterVerify(@Req() req: any, @Body() body: any, @Headers('origin') origin?: string) {
    return this.authService.passkeyRegisterVerify(req.user, body, origin);
  }

  @Post('passkey/login/options')
  async passkeyLoginOptions(@Body() body: { email?: string }, @Headers('origin') origin?: string, @Req() req?: any) {
    await this.authService.consumeAuthEndpointRateLimit('passkey-login-options', req?.ip, body?.email || '');
    return this.authService.passkeyLoginOptions(body?.email, origin);
  }

  @Post('passkey/login/verify')
  async passkeyLoginVerify(@Body() body: any, @Headers('origin') origin?: string, @Req() req?: any) {
    const credentialId = String(body?.credential?.id || body?.id || '');
    await this.authService.consumeAuthEndpointRateLimit('passkey-login-verify', req?.ip, credentialId);
    return this.authService.passkeyLoginVerify(body, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: any) { return req.user; }
}
