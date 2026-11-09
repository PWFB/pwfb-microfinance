import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type AccessUser = { id?: string; role?: string; staffId?: string };

@Injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getScope(user: AccessUser) {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'SUPER_ADMIN') return { role, staffId: user?.staffId ?? null, branchId: null, areaId: null, divisionId: null, regionId: null, global: true };
    const userId = String(user?.id || '').trim();
    const staffId = String(user?.staffId || '').trim();
    const rows = (staffId || userId)
      ? await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE ($1 <> '' AND "id" = $1) OR ($2 <> '' AND "userId" = $2) LIMIT 1`,
          staffId, userId,
        )
      : [];
    const staff = rows[0] || {};
    return {
      role,
      staffId: staff.id ?? null,
      branchId: staff.branchId ?? null,
      areaId: staff.areaId ?? null,
      divisionId: staff.divisionId ?? null,
      regionId: staff.regionId ?? null,
      // Only Super Admin is organization-wide. An Admin without an assigned
      // organizational record is deliberately not granted global access.
      global: false,
    };
  }

  private async assertOrg(user: AccessUser, target: any) {
    const scope = await this.getScope(user);
    if (scope.global) return true;
    if (!target) throw new ForbiddenException('Access denied: record not found');
    const same = (a: unknown, b: unknown) => Boolean(a && b && String(a) === String(b));
    if (scope.role === 'REGIONAL_MANAGER' && same(scope.regionId, target.regionId)) return true;
    if (scope.role === 'DIVISIONAL_MANAGER' && same(scope.divisionId, target.divisionId)) return true;
    if (scope.role === 'AREA_MANAGER' && same(scope.areaId, target.areaId)) return true;
    if (scope.role === 'CREDIT_OFFICER' && Object.prototype.hasOwnProperty.call(target, 'assignedStaffId')) {
      if (same(scope.staffId, target.assignedStaffId)) return true;
      throw new ForbiddenException('Access denied: this record is not assigned to your staff account');
    }
    // Credit Officers still need access to their own branch metadata; record
    // ownership is checked only for Customer/Loan targets that carry assignedStaffId.
    if (same(scope.branchId, target.branchId)) return true;
    throw new ForbiddenException('Access denied: outside your organizational scope');
  }

  async filterList(user: AccessUser, resource: string, rows: any[]) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;
    const scope = await this.getScope(user);
    if (scope.global) return rows;
    const ids = rows.map((row) => String(row?.id || '')).filter(Boolean);
    if (!ids.length) return rows;
    let allowed: any[] = [];
    if (resource === 'staff') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id" FROM "Staff" WHERE "id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'Staff')})`, ids);
    } else if (resource === 'customers') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c."id" FROM "Customer" c LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE c."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${scope.role === 'CREDIT_OFFICER' ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'loans') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT l."id" FROM "Loan" l JOIN "Customer" c ON c."id"=l."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE l."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${scope.role === 'CREDIT_OFFICER' ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'savings') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT s."id" FROM "Savings" s JOIN "Customer" c ON c."id"=s."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE s."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})`, ids);
    } else if (resource === 'collections') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT dc."id" FROM "DailyCollection" dc LEFT JOIN "Branch" b ON b."id"=dc."branchId" WHERE dc."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})`, ids);
    } else if (resource === 'cashbook_daily') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT r.id FROM cashbook_daily_records r JOIN "Branch" b ON b.id = r.branch_id
         WHERE r.id = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})
         ${scope.role === 'CREDIT_OFFICER' ? `AND r.staff_id = '${this.escape(scope.staffId)}'` : ''}`,
        ids,
      );
    } else if (resource === 'cashbook_entries') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT e."id" FROM "CashbookEntry" e JOIN "Branch" b ON b."id" = e."branchId"
         WHERE e."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})`,
        ids,
      );
    } else if (resource === 'branches') {
      const condition = scope.role === 'REGIONAL_MANAGER' ? `"regionId"='${this.escape(scope.regionId)}'` : scope.role === 'DIVISIONAL_MANAGER' ? `"divisionId"='${this.escape(scope.divisionId)}'` : scope.role === 'AREA_MANAGER' ? `"areaId"='${this.escape(scope.areaId)}'` : `"id"='${this.escape(scope.branchId)}'`;
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id" FROM "Branch" WHERE "id" = ANY($1::text[]) AND ${condition}`, ids);
    } else return rows;
    const allowedIds = new Set(allowed.map((row) => String(row.id)));
    return rows.filter((row) => allowedIds.has(String(row?.id)));
  }

  private orgCondition(scope: any, alias: string) {
    if (scope.role === 'REGIONAL_MANAGER') return `"${alias}"."regionId" = '${this.escape(scope.regionId)}'`;
    if (scope.role === 'DIVISIONAL_MANAGER') return `"${alias}"."divisionId" = '${this.escape(scope.divisionId)}'`;
    if (scope.role === 'AREA_MANAGER') return `"${alias}"."areaId" = '${this.escape(scope.areaId)}'`;
    if (alias === 'b') return `"${alias}"."id" = '${this.escape(scope.branchId)}'`;
    return `"${alias}"."branchId" = '${this.escape(scope.branchId)}'`;
  }

  private escape(value: unknown) { return String(value ?? '').replace(/'/g, "''"); }

  async assertBranch(user: AccessUser, branchId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "id" AS "branchId", "areaId", "divisionId", "regionId" FROM "Branch" WHERE "id" = $1 LIMIT 1`, branchId);
    return this.assertOrg(user, rows[0]);
  }
  async assertStaff(user: AccessUser, targetStaffId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE "id" = $1 LIMIT 1`, targetStaffId); return this.assertOrg(user, rows[0]);
  }
  async assertCustomer(user: AccessUser, customerId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId" FROM "Customer" c LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE c."id" = $1 LIMIT 1`, customerId); return this.assertOrg(user, rows[0]);
  }
  async assertLoan(user: AccessUser, loanId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT l."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId" FROM "Loan" l JOIN "Customer" c ON c."id" = l."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE l."id" = $1 LIMIT 1`, loanId); return this.assertOrg(user, rows[0]);
  }
  async assertSavings(user: AccessUser, savingsId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT s."id", c."branchId", b."areaId", b."divisionId", b."regionId" FROM "Savings" s JOIN "Customer" c ON c."id" = s."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE s."id" = $1 LIMIT 1`, savingsId); return this.assertOrg(user, rows[0]);
  }
  async assertCollection(user: AccessUser, collectionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT dc."id", dc."branchId", b."areaId", b."divisionId", b."regionId" FROM "DailyCollection" dc LEFT JOIN "Branch" b ON b."id" = dc."branchId" WHERE dc."id" = $1 LIMIT 1`, collectionId); return this.assertOrg(user, rows[0]);
  }
}
