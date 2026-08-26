import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { createHash } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'pwfb-secret-key',
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        customerId: true,
        staffId: true,
      },
    });

    if (!user) return null;

    let twoFactorRequired = false;
    try {
      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserTwoFactorSession" ("tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "verifiedUntil" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserAuthenticator" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "secretEnc" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT FALSE, "recoveryCodes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      const authenticator = await this.prisma.$queryRawUnsafe<Array<{ enabled: boolean }>>(`SELECT "enabled" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, user.id);
      if (authenticator[0]?.enabled) {
        const authHeader = String(request?.headers?.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
        const tokenHash = token ? createHash('sha256').update(token).digest('hex') : '';
        const verified = tokenHash
          ? await this.prisma.$queryRawUnsafe<Array<{ verifiedUntil: Date }>>(`SELECT "verifiedUntil" FROM "UserTwoFactorSession" WHERE "tokenHash" = $1 AND "userId" = $2 AND "verifiedUntil" > CURRENT_TIMESTAMP LIMIT 1`, tokenHash, user.id)
          : [];
        twoFactorRequired = !verified.length;
      }
    } catch {
      // Keep normal authentication available if the optional 2FA tables cannot be checked.
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      customerId: user.customerId,
      staffId: user.staffId,
      twoFactorRequired,
      twoFactorPending: twoFactorRequired,
    };
  }
}
