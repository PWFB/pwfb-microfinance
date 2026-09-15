import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<any>();
    const method = String(req.method || 'GET').toUpperCase();
    const path = String(req.originalUrl || req.url || '');
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    const excluded = path.startsWith('/auth') || path.startsWith('/audit') || path === '/' || path.startsWith('/health');
    if (!isMutation || excluded) return next.handle();

    const user = req.user || {};
    const recordId = this.extractId(path);
    const details = this.sanitize(req.body);
    const action = this.actionFor(method, path);
    const ipAddress = req.ip || req.headers?.['x-forwarded-for'] || null;
    const userAgent = req.headers?.['user-agent'] || null;

    return next.handle().pipe(tap({
      next: () => void this.audit.record({ actorId: user.sub || user.id || null, actorEmail: user.email || null, actorRole: user.role || null, action, method, resource: path.split('?')[0], recordId, details, ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : String(ipAddress || ''), userAgent: String(userAgent || ''), statusCode: 200 }),
      error: (error) => void this.audit.record({ actorId: user.sub || user.id || null, actorEmail: user.email || null, actorRole: user.role || null, action: `${action}_FAILED`, method, resource: path.split('?')[0], recordId, details: { ...details, error: error?.message || 'Request failed' }, ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : String(ipAddress || ''), userAgent: String(userAgent || ''), statusCode: Number(error?.status || 500) }),
    }));
  }

  private actionFor(method: string, path: string) {
    const resource = path.split('?')[0].replace(/^\//, '').replace(/\//g, '_').replace(/[^a-zA-Z0-9_:-]/g, '');
    return `${method}_${resource || 'REQUEST'}`.toUpperCase();
  }

  private extractId(path: string) {
    const parts = path.split('?')[0].split('/').filter(Boolean);
    const candidate = parts.length > 1 ? parts[parts.length - 1] : null;
    return candidate && !['close','approve','pay','reconcile','unreconcile','ensure','search'].includes(candidate) ? candidate : null;
  }

  private sanitize(value: any): Record<string, unknown> {
    if (!value || typeof value !== 'object') return {};
    const blocked = /password|token|secret|authorization|refresh|accessToken|credential|privateKey|bvn/i;
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (blocked.test(key)) continue;
      if (typeof val === 'string' && val.length > 500) out[key] = `${val.slice(0, 500)}…`;
      else if (val === null || ['string','number','boolean'].includes(typeof val)) out[key] = val;
      else if (Array.isArray(val)) out[key] = `[${val.length} items]`;
      else out[key] = '[object]';
    }
    return out;
  }
}
