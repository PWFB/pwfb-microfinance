import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';

@Injectable()
export class AccessScopeInterceptor implements NestInterceptor {
  constructor(private readonly scope: AccessScopeService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return next.handle();

    const path = String(request.route?.path || request.path || '').toLowerCase();
    const id = request.params?.id;
    const branchId = request.params?.branchId || request.body?.branchId || request.query?.branchId;
    const staffId = request.params?.staffId || request.body?.staffId || request.query?.staffId;
    const customerId = request.params?.customerId || request.body?.customerId || request.query?.customerId;

    if (branchId) await this.scope.assertBranch(user, String(branchId));
    if (staffId) await this.scope.assertStaff(user, String(staffId));
    if (customerId) await this.scope.assertCustomer(user, String(customerId));

    if (id) {
      if (path.includes('/staff')) await this.scope.assertStaff(user, String(id));
      else if (path.includes('/customers')) await this.scope.assertCustomer(user, String(id));
      else if (path.includes('/loans')) await this.scope.assertLoan(user, String(id));
      else if (path.includes('/savings')) await this.scope.assertSavings(user, String(id));
      else if (path.includes('/collections')) await this.scope.assertCollection(user, String(id));
      else if (path.includes('/branches')) await this.scope.assertBranch(user, String(id));
    }

    const { map } = require('rxjs');
    const resource = path.includes('/staff') ? 'staff'
      : path.includes('/customers') ? 'customers'
      : path.includes('/loans') ? 'loans'
      : path.includes('/savings') ? 'savings'
      : path.includes('/collections') ? 'collections'
      : path.includes('/branches') ? 'branches'
      : '';

    if (!resource || id) return next.handle();

    return next.handle().pipe(map(async (data: any) => {
      if (Array.isArray(data)) return this.scope.filterList(user, resource, data);
      if (Array.isArray(data?.data)) return { ...data, data: await this.scope.filterList(user, resource, data.data) };
      if (Array.isArray(data?.items)) return { ...data, items: await this.scope.filterList(user, resource, data.items) };
      return data;
    }));
  }
}
