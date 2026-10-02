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
      secretOrKey: process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'pwfb-test-only-secret' : (() => { throw new Error('JWT_SECRET must be configured before JwtStrategy starts'); })()),
      passReqToCallback: true,
    });
  }

  async validate(request: any, payload: any) {
    const subject = String(payload?.sub || payload?.userId || payload?.id || '').trim();
    if (!subject) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: subject },
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
