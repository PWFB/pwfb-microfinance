import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import './auth-passkey.extension';
import './auth-customer-link.extension';

const jwtSecret = process.env.JWT_SECRET?.trim() ||
  (process.env.NODE_ENV === 'test' ? 'pwfb-test-only-secret' : '');

if (!jwtSecret) {
  throw new Error('JWT_SECRET must be configured before PWFB authentication can start.');
}

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    JwtStrategy,
  ],
  exports: [
    AuthService,
    TwoFactorService,
  ],
})
export class AuthModule {}
