import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';

@Injectable()
export class AccessScopeGuard implements CanActivate {
  constructor(private readonly scope: AccessScopeService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const branchId = request.params?.branchId || request.body?.branchId || request.query?.branchId;
    if (branchId) await this.scope.assertBranch(user, String(branchId));
    const targetStaffId = request.params?.staffId || request.body?.staffId || request.query?.staffId;
    if (targetStaffId) await this.scope.assertStaff(user, String(targetStaffId));
    return true;
  }
}
