import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PERMISSION_KEYS = [
  'WALLET_DEPOSIT','WALLET_WITHDRAWAL','BANK_TRANSFER',
  'CUSTOMER_CREATE','CUSTOMER_EDIT',
  'SAVINGS_CREATE','SAVINGS_WITHDRAW',
  'LOAN_CREATE','LOAN_DISBURSE',
  'COLLECTION_CREATE','COLLECTION_SETTLE',
] as const;
type PermissionKey = typeof PERMISSION_KEYS[number];

const ALL = {
  WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true, BANK_TRANSFER: true,
  CUSTOMER_CREATE: true, CUSTOMER_EDIT: true,
  SAVINGS_CREATE: true, SAVINGS_WITHDRAW: true,
  LOAN_CREATE: true, LOAN_DISBURSE: true,
  COLLECTION_CREATE: true, COLLECTION_SETTLE: true,
};
const NONE = Object.fromEntries(Object.keys(ALL).map(k => [k, false])) as Record<PermissionKey, boolean>;

const DEFAULTS: Record<string, Record<PermissionKey, boolean>> = {
  SUPER_ADMIN: { ...ALL },
  ADMIN: { ...ALL },
  BRANCH_MANAGER: { ...ALL },
  TELLER: { ...ALL, LOAN_CREATE: false, LOAN_DISBURSE: false, COLLECTION_CREATE: true },
  STAFF: { ...NONE, BANK_TRANSFER: true, COLLECTION_CREATE: true, COLLECTION_SETTLE: true, SAVINGS_CREATE: true },
  CUSTOMER_SERVICE: { ...NONE, CUSTOMER_CREATE: true, CUSTOMER_EDIT: true, SAVINGS_CREATE: true },
  LOAN_OFFICER: { ...NONE, LOAN_CREATE: true, COLLECTION_CREATE: true, COLLECTION_SETTLE: true },
  CREDIT_OFFICER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_CREATE: true, COLLECTION_SETTLE: true },
  AUDITOR: { ...NONE },
  REGIONAL_MANAGER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_SETTLE: true },
  DIVISIONAL_MANAGER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_SETTLE: true },
  AREA_MANAGER: { ...NONE, LOAN_CREATE: true, COLLECTION_SETTLE: true },
  MONITORING_TEAM: { ...NONE },
  CUSTOMER: { ...NONE, BANK_TRANSFER: true },
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * This table is intentionally managed with SQL because it is not a Prisma
   * model. Create it before reading or writing so the UI never silently falls
   * back to defaults while the toggle writes to a missing table.
   */
  private async ensureTable() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RolePermission" (
        "id" TEXT PRIMARY KEY,
        "role" TEXT NOT NULL,
        "permission" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "RolePermission_role_permission_key" UNIQUE ("role", "permission")
      )
    `);
    await this.prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission" ("role")');
  }

  async list() {
    await this.ensureTable();
    const rows = await this.prisma.$queryRawUnsafe<Array<{ role: string; permission: string; enabled: boolean }>>(
      'SELECT "role", "permission", "enabled" FROM "RolePermission" ORDER BY "role", "permission"',
    );
    const out: Record<string, any> = JSON.parse(JSON.stringify(DEFAULTS));
    for (const row of rows) {
      if (!out[row.role]) out[row.role] = {};
      out[row.role][row.permission] = row.enabled;
    }
    return Object.entries(out).map(([role, permissions]) => ({ role, permissions }));
  }

  async get(role: string, permission: PermissionKey) {
    await this.ensureTable();
    const rows = await this.prisma.$queryRawUnsafe<Array<{ enabled: boolean }>>(
      'SELECT "enabled" FROM "RolePermission" WHERE "role" = $1 AND "permission" = $2 LIMIT 1',
      role, permission,
    );
    if (rows[0]) return rows[0].enabled;
    return DEFAULTS[role]?.[permission] ?? false;
  }

  async assert(role: string, permission: PermissionKey) {
    if (!(await this.get(role, permission))) throw new ForbiddenException(`Permission denied: ${permission}`);
    return true;
  }

  async set(role: string, permission: PermissionKey, enabled: boolean) {
    await this.ensureTable();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("role","permission") DO UPDATE SET "enabled"=$4,"updatedAt"=CURRENT_TIMESTAMP',
      `rp_${role}_${permission}`, role, permission, enabled,
    );
    const persisted = await this.get(role, permission);
    if (persisted !== enabled) throw new Error('Permission change could not be confirmed from the database');
    return { role, permission, enabled: persisted };
  }
}
