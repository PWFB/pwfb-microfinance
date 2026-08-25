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
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Verify a Google Identity Services ID token and issue a PWFB JWT. */
  @Post('google')
  googleLogin(
    @Body() body: { credential: string; client_id?: string; nonce?: string },
    @Headers('origin') origin?: string,
  ) {
    return this.authService.googleLogin(
      body?.credential,
      origin,
      body?.client_id,
      body?.nonce,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/options')
  passkeyRegisterOptions(@Req() req: any) {
    return this.authService.passkeyRegisterOptions(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('passkey/register/verify')
  passkeyRegisterVerify(@Req() req: any, @Body() body: any) {
    return this.authService.passkeyRegisterVerify(req.user, body);
  }

  @Post('passkey/login/options')
  passkeyLoginOptions(@Body() body: { email: string }) {
    return this.authService.passkeyLoginOptions(body.email);
  }

  @Post('passkey/login/verify')
  passkeyLoginVerify(@Body() body: any) {
    return this.authService.passkeyLoginVerify(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: any) {
    return req.user;
  }
}
