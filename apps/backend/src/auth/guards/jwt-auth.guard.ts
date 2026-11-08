import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err) throw err;
    if (!user) throw new UnauthorizedException(info?.message || 'Unauthorized');

    if (user.twoFactorPending) {
      const request = context.switchToHttp().getRequest();
      const path = String(request?.route?.path || request?.path || '');
      if (path !== '/auth/profile') {
        throw new UnauthorizedException('Two-factor authentication required');
      }
    }

    return user;
  }
}
