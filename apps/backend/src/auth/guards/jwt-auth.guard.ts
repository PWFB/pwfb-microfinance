import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err) throw err;
    if (!user) throw new UnauthorizedException(info?.message || 'Unauthorized');

    if (user.twoFactorPending) {
      const request = context.switchToHttp().getRequest();
      const fullPath = String(request?.originalUrl || request?.path || '').split('?')[0];
      const routePath = String(request?.route?.path || '');
      const allowed = new Set([
        '/auth/profile', '/profile',
        '/auth/authenticator/status', '/authenticator/status',
        '/auth/authenticator/setup', '/authenticator/setup',
        '/auth/authenticator/verify', '/authenticator/verify',
      ]);
      if (!allowed.has(fullPath) && !allowed.has(routePath)) {
        throw new UnauthorizedException('Two-factor setup or verification is required before protected access');
      }
    }

    return user;
  }
}
