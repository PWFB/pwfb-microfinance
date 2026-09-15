import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AccessUser = { id?: string; role?: string; staffId?: string; };

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getScope(user: AccessUser) {
    const role = String(user?.role || '');
    if (!user?.staffId) return { role, staffId: null, branchId: null, areaId: null, divisionId: null, regionId: null, global: role === 'SUPER_ADMIN' || role === 'ADMIN' };

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT s."id", s."branchId", s."areaId", s."divisionId", s."regionId"
       FROM "Staff" s WHERE s."id" = $1 LIMIT 1`, user.staffId,
    );
    const staff = rows[0] || {};
    return {
      role,
      staffId: user.staffId,
      branchId: staff.branchId ?? null,
      areaId: staff.areaId ?? null,
      divisionId: staff.divisionId ?? null,
      regionId: staff.regionId ?? null,
      global: role === 'SUPER_ADMIN' || role === 'ADMIN',
    };
  }

  async assertBranch(user: AccessUser, branchId: string) {
    const scope = await this.getScope(user);
    if (scope.global) return true;
    if (!branchId || !scope.branchId || String(scope.branchId) !== String(branchId)) {
      throw new ForbiddenException('Access denied: outside your branch scope');
    }
    return true;
  }

  async assertStaff(user: AccessUser, targetStaffId: string) {
    const scope = await this.getScope(user);
    if (scope.global || scope.staffId === targetStaffId) return true;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE "id" = $1 LIMIT 1`, targetStaffId,
    );
    const target = rows[0];
    if (!target) throw new ForbiddenException('Staff record not found');
    if (scope.branchId && String(scope.branchId) === String(target.branchId)) return true;
    if (scope.areaId && String(scope.areaId) === String(target.areaId)) return true;
    if (scope.divisionId && String(scope.divisionId) === String(target.divisionId)) return true;
    if (scope.regionId && String(scope.regionId) === String(target.regionId)) return true;
    throw new ForbiddenException('Access denied: outside your organizational scope');
  }
}
