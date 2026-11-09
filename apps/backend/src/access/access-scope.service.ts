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
    let rows: any[] = [];
    if (userId) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "Staff" WHERE "userId" = $1 LIMIT 1`,
        userId,
      );
    }
    if (!rows[0] && staffId) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "Staff" WHERE "id" = $1 LIMIT 1`,
        staffId,
      );
    }
    const staff = rows[0];
    if (!staff?.id) {
      if (role === 'CUSTOMER') {
        return { role, staffId: null, branchId: null, areaId: null, divisionId: null, regionId: null, global: false };
      }
      throw new ForbiddenException('No Staff profile is linked to this account. Ask an administrator to connect your staff login.');
    }
    if (staffId && staff.id !== staffId) {
      throw new ForbiddenException('Staff identity links do not match. Contact Super Admin to reconcile the login before processing financial records.');
    }

    const assignments: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "role", "branchId", "areaId", "divisionId", "regionId"
       FROM "StaffAssignment"
       WHERE "staffId" = $1
         AND "active" = TRUE
         AND "startsAt" <= CURRENT_TIMESTAMP
         AND ("endsAt" IS NULL OR "endsAt" > CURRENT_TIMESTAMP)
       ORDER BY "startsAt" DESC
       LIMIT 1`,
      staff.id,
    );
    const assignment = assignments[0];
    if (!assignment) {
      throw new ForbiddenException('No active Staff Assignment is linked to this account. Assign the correct role and branch before accessing financial records.');
    }
    if (String(assignment.role || '').toUpperCase() !== role) {
      throw new ForbiddenException('Your login role does not match your active Staff Assignment. Ask an administrator to reconcile the assignment.');
    }
    const requiredTarget: Record<string, string> = {
      ADMIN: 'branchId',
      BRANCH_MANAGER: 'branchId',
      CREDIT_OFFICER: 'branchId',
      TELLER: 'branchId',
      LOAN_OFFICER: 'branchId',
      STAFF: 'branchId',
      AREA_MANAGER: 'areaId',
      DIVISIONAL_MANAGER: 'divisionId',
      REGIONAL_MANAGER: 'regionId',
    };
    const requiredField = requiredTarget[role];
    if (requiredField && !assignment[requiredField]) {
      throw new ForbiddenException(`The active ${role} assignment is missing its required ${requiredField} target.`);
    }

    return {
      role,
      staffId: staff.id,
      // The active assignment is authoritative. Do not fall back to stale
      // Staff profile hierarchy fields when the assignment intentionally has
      // a null or different branch/area/division/region.
      branchId: assignment.branchId ?? null,
      areaId: assignment.areaId ?? null,
      divisionId: assignment.divisionId ?? null,
      regionId: assignment.regionId ?? null,
      global: false,
    };
  }

  async getScopedBranchIds(user: AccessUser): Promise<string[] | null> {
    const scope = await this.getScope(user);
    if (scope.global) return null;
    let rows: any[] = [];
    if ((scope.role === 'REGIONAL_MANAGER' || ['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) && scope.regionId) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "Branch" WHERE "regionId" = $1 ORDER BY "name" ASC`,
        scope.regionId,
      );
    } else if ((scope.role === 'DIVISIONAL_MANAGER' || ['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) && scope.divisionId) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "Branch" WHERE "divisionId" = $1 ORDER BY "name" ASC`,
        scope.divisionId,
      );
    } else if ((scope.role === 'AREA_MANAGER' || ['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) && scope.areaId) {
      rows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "Branch" WHERE "areaId" = $1 ORDER BY "name" ASC`,
        scope.areaId,
      );
    } else if (scope.branchId) {
      rows = [{ id: scope.branchId }];
    } else if (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role) && !scope.regionId && !scope.divisionId && !scope.areaId) {
      // Audit and monitoring assignments without a narrower organizational
      // target are organization-wide read scopes; controller roles remain read-only.
      rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT \"id\" FROM \"Branch\" ORDER BY \"name\" ASC`);
    }
    return rows.map((row) => String(row.id)).filter(Boolean);
  }

  private async assertOrg(user: AccessUser, target: any) {
    const scope = await this.getScope(user);
    if (scope.global) return true;
    if (!target) throw new ForbiddenException('Access denied: record not found');
    const same = (a: unknown, b: unknown) => Boolean(a && b && String(a) === String(b));
    if (scope.role === 'REGIONAL_MANAGER' && same(scope.regionId, target.regionId)) return true;
    if (scope.role === 'DIVISIONAL_MANAGER' && same(scope.divisionId, target.divisionId)) return true;
    if (scope.role === 'AREA_MANAGER' && same(scope.areaId, target.areaId)) return true;
    if (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) {
      if (scope.regionId) return same(scope.regionId, target.regionId);
      if (scope.divisionId) return same(scope.divisionId, target.divisionId);
      if (scope.areaId) return same(scope.areaId, target.areaId);
      if (scope.branchId) return same(scope.branchId, target.branchId);
      return true;
    }
    if (['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'].includes(scope.role) && Object.prototype.hasOwnProperty.call(target, 'assignedStaffId')) {
      if (same(scope.staffId, target.assignedStaffId)) return true;
      throw new ForbiddenException('Access denied: this record is not assigned to your staff account');
    }
    if (['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'].includes(scope.role) && Object.prototype.hasOwnProperty.call(target, 'staffId')) {
      if (same(scope.staffId, target.staffId)) return true;
      throw new ForbiddenException('Access denied: this record is not linked to your Staff ID');
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
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id" FROM "Staff" WHERE "id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'Staff')}) ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND "id" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'customers') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c."id" FROM "Customer" c LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE c."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'loans') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT l."id" FROM "Loan" l JOIN "Customer" c ON c."id"=l."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE l."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'savings') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT s."id" FROM "Savings" s JOIN "Customer" c ON c."id"=s."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId" WHERE s."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'collections') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT dc."id" FROM "DailyCollection" dc LEFT JOIN "Branch" b ON b."id"=dc."branchId" WHERE dc."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')}) ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND dc."staffId" = '${this.escape(scope.staffId)}'` : ''}`, ids);
    } else if (resource === 'transactions') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT t."id" FROM "Transaction" t
         JOIN "Customer" c ON c."id"=t."customerId"
         LEFT JOIN "Branch" b ON b."id"=c."branchId"
         WHERE t."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})
         ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}
         UNION
         SELECT w."id" FROM "WalletTransaction" w
         JOIN "Customer" c ON c."id"=w."customerId"
         LEFT JOIN "Branch" b ON b."id"=COALESCE(w."branchId",c."branchId")
         WHERE w."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})
         ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND c."assignedStaffId" = '${this.escape(scope.staffId)}'` : ''}`,
        ids,
      );
    } else if (resource === 'cashbook_daily') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT r.id FROM cashbook_daily_records r JOIN "Branch" b ON b.id = r.branch_id
         WHERE r.id = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})
         ${['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role) ? `AND r.staff_id = '${this.escape(scope.staffId)}'` : ''}`,
        ids,
      );
    } else if (resource === 'cashbook_entries') {
      allowed = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT e."id" FROM "CashbookEntry" e JOIN "Branch" b ON b."id" = e."branchId"
         WHERE e."id" = ANY($1::text[]) AND (${this.orgCondition(scope, 'b')})`,
        ids,
      );
    } else if (resource === 'branches') {
      const condition = this.branchCondition(scope);
      allowed = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id" FROM "Branch" WHERE "id" = ANY($1::text[]) AND ${condition}`, ids);
    } else return rows;
    const allowedIds = new Set(allowed.map((row) => String(row.id)));
    return rows.filter((row) => allowedIds.has(String(row?.id)));
  }

  private branchCondition(scope: any) {
    if (scope.role === 'REGIONAL_MANAGER' || (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role) && scope.regionId)) return `"regionId" = '${this.escape(scope.regionId)}'`;
    if (scope.role === 'DIVISIONAL_MANAGER' || (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role) && scope.divisionId)) return `"divisionId" = '${this.escape(scope.divisionId)}'`;
    if (scope.role === 'AREA_MANAGER' || (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role) && scope.areaId)) return `"areaId" = '${this.escape(scope.areaId)}'`;
    if (scope.branchId) return `"id" = '${this.escape(scope.branchId)}'`;
    if (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) return 'TRUE';
    return `"id" = '__no_access__'`;
  }

  private orgCondition(scope: any, alias: string) {
    if (['AUDITOR', 'MONITORING_TEAM'].includes(scope.role)) {
      if (scope.regionId) return `"${alias}"."regionId" = '${this.escape(scope.regionId)}'`;
      if (scope.divisionId) return `"${alias}"."divisionId" = '${this.escape(scope.divisionId)}'`;
      if (scope.areaId) return `"${alias}"."areaId" = '${this.escape(scope.areaId)}'`;
      if (scope.branchId) return alias === 'b' ? `"${alias}"."id" = '${this.escape(scope.branchId)}'` : `"${alias}"."branchId" = '${this.escape(scope.branchId)}'`;
      return 'TRUE';
    }
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
    const scope = await this.getScope(user);
    if (['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'].includes(scope.role) && String(scope.staffId || '') !== String(targetStaffId || '')) {
      throw new ForbiddenException('A Credit Officer can only access their own staff record');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "id", "branchId", "areaId", "divisionId", "regionId" FROM "Staff" WHERE "id" = $1 LIMIT 1`, targetStaffId);
    return this.assertOrg(user, rows[0]);
  }
  async assertCustomer(user: AccessUser, customerId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId" FROM "Customer" c LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE c."id" = $1 LIMIT 1`, customerId); return this.assertOrg(user, rows[0]);
  }
  async assertLoan(user: AccessUser, loanId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT l."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId" FROM "Loan" l JOIN "Customer" c ON c."id" = l."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE l."id" = $1 LIMIT 1`, loanId); return this.assertOrg(user, rows[0]);
  }
  async assertTransaction(user: AccessUser, transactionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT t."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId"
       FROM "Transaction" t JOIN "Customer" c ON c."id"=t."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId"
       WHERE t."id"=$1
       UNION
       SELECT w."id", COALESCE(w."branchId",c."branchId") AS "branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId"
       FROM "WalletTransaction" w JOIN "Customer" c ON c."id"=w."customerId"
       LEFT JOIN "Branch" b ON b."id"=COALESCE(w."branchId",c."branchId") WHERE w."id"=$1 LIMIT 1`,
      transactionId,
    );
    return this.assertOrg(user, rows[0]);
  }
  async assertSavings(user: AccessUser, savingsId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT s."id", c."branchId", c."assignedStaffId", b."areaId", b."divisionId", b."regionId" FROM "Savings" s JOIN "Customer" c ON c."id" = s."customerId" LEFT JOIN "Branch" b ON b."id" = c."branchId" WHERE s."id" = $1 LIMIT 1`, savingsId); return this.assertOrg(user, rows[0]);
  }
  async assertCollection(user: AccessUser, collectionId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT dc."id", dc."branchId", dc."staffId", b."areaId", b."divisionId", b."regionId" FROM "DailyCollection" dc LEFT JOIN "Branch" b ON b."id" = dc."branchId" WHERE dc."id" = $1 LIMIT 1`, collectionId);
    const scope = await this.getScope(user);
    if (['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'].includes(scope.role) && String(rows[0]?.staffId || '') !== String(scope.staffId || '')) {
      throw new ForbiddenException('A Credit Officer can only access their own collection records');
    }
    return this.assertOrg(user, rows[0]);
  }
}
