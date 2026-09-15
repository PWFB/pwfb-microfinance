import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AccessUser = { id?: string; role?: string; staffId?: string };

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getScope(user: AccessUser) {
    const role = String(user?.role || '');
    if (!user?.staffId) return { role, staffId: null, branchId: null, areaId: null, divisionId: null, regionId: null, global: role === 'SUPER_ADMIN' || role === 'ADMIN' };
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE "id" = $1 LIMIT 1`, user.staffId);
    const staff = rows[0] || {};
    return { role, staffId: user.staffId, branchId: staff.branchId ?? null, areaId: staff.areaId ?? null, divisionId: staff.divisionId ?? null, regionId: staff.regionId ?? null, global: role === 'SUPER_ADMIN' || role === 'ADMIN' };
  }

  private async assertOrg(user: AccessUser, target: any) {
    const scope = await this.getScope(user);
    if (scope.global) return true;
    if (!target) throw new ForbiddenException('Access denied: record not found');
    const role = scope.role;
    const same = (a: unknown, b: unknown) => Boolean(a && b && String(a) === String(b));
    if (role === 'REGIONAL_MANAGER') {
      if (same(scope.regionId, target.regionId)) return true;
    } else if (role === 'DIVISIONAL_MANAGER') {
      if (same(scope.divisionId, target.divisionId)) return true;
    } else if (role === 'AREA_MANAGER') {
      if (same(scope.areaId, target.areaId)) return true;
    } else if (same(scope.branchId, target.branchId)) {
      return true;
    }
    throw new ForbiddenException('Access denied: outside your organizational scope');
  }

  async assertBranch(user: AccessUser, branchId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Branch" WHERE "id" = $1 LIMIT 1`, branchId);
    return this.assertOrg(user, rows[0]);
  }

  async assertStaff(user: AccessUser, targetStaffId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE "id" = $1 LIMIT 1`, targetStaffId);
    return this.assertOrg(user, rows[0]);
  }

  async assertCustomer(user: AccessUser, customerId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c."id", c."branchId", b."areaId", b."divisionId", b."regionId" FROM "Customer" c LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE c."id" = $1 LIMIT 1`, customerId);
    return this.assertOrg(user, rows[0]);
  }

  async assertLoan(user: AccessUser, loanId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT l."id", c."branchId", b."areaId", b."divisionId", b."regionId" FROM "Loan" l JOIN "Customer" c ON c."id" = l."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE l."id" = $1 LIMIT 1`, loanId);
    return this.assertOrg(user, rows[0]);
  }

  async assertSavings(user: AccessUser, savingsId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT s."id", c."branchId", b."areaId", b."divisionId", b."regionId" FROM "Savings" s JOIN "Customer" c ON c."id" = s."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE s."id" = $1 LIMIT 1`, savingsId);
    return this.assertOrg(user, rows[0]);
  }

  async assertCollection(user: AccessUser, collectionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT dc."id", dc."branchId", b."areaId", b."divisionId", b."regionId" FROM "DailyCollection" dc LEFT JOIN "Branch" b ON b."id" = dc."branchId" WHERE dc."id" = $1 LIMIT 1`, collectionId);
    return this.assertOrg(user, rows[0]);
  }
}
