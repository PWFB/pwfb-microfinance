import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PERMISSION_KEYS = [
  'WALLET_DEPOSIT','WALLET_WITHDRAWAL',
  'CUSTOMER_CREATE','CUSTOMER_EDIT',
  'SAVINGS_CREATE','SAVINGS_WITHDRAW',
  'LOAN_CREATE','LOAN_DISBURSE',
  'COLLECTION_CREATE','COLLECTION_SETTLE',
] as const;
type PermissionKey = typeof PERMISSION_KEYS[number];

const ALL = {
  WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true,
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
  STAFF: { ...NONE, COLLECTION_CREATE: true, COLLECTION_SETTLE: true, SAVINGS_CREATE: true },
  CUSTOMER_SERVICE: { ...NONE, CUSTOMER_CREATE: true, CUSTOMER_EDIT: true, SAVINGS_CREATE: true },
  LOAN_OFFICER: { ...NONE, LOAN_CREATE: true, COLLECTION_CREATE: true, COLLECTION_SETTLE: true },
  CREDIT_OFFICER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_CREATE: true, COLLECTION_SETTLE: true },
  AUDITOR: { ...NONE },
  REGIONAL_MANAGER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_SETTLE: true },
  DIVISIONAL_MANAGER: { ...NONE, LOAN_CREATE: true, LOAN_DISBURSE: true, COLLECTION_SETTLE: true },
  AREA_MANAGER: { ...NONE, LOAN_CREATE: true, COLLECTION_SETTLE: true },
  MONITORING_TEAM: { ...NONE },
  CUSTOMER: { ...NONE },
};

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async tableAvailable() {
    try { await this.prisma.$queryRawUnsafe('SELECT 1 FROM "RolePermission" LIMIT 1'); return true; }
    catch { return false; }
  }

  async list() {
    if (!(await this.tableAvailable())) return Object.entries(DEFAULTS).map(([role, permissions]) => ({ role, permissions }));
    const rows = await this.prisma.$queryRawUnsafe<Array<{ role: string; permission: string; enabled: boolean }>>('SELECT "role", "permission", "enabled" FROM "RolePermission" ORDER BY "role", "permission"');
    const out: Record<string, any> = JSON.parse(JSON.stringify(DEFAULTS));
    for (const r of rows) { if (!out[r.role]) out[r.role] = {}; out[r.role][r.permission] = r.enabled; }
    return Object.entries(out).map(([role, permissions]) => ({ role, permissions }));
  }

  async get(role: string, permission: PermissionKey) {
    if (await this.tableAvailable()) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ enabled: boolean }>>('SELECT "enabled" FROM "RolePermission" WHERE "role" = $1 AND "permission" = $2 LIMIT 1', role, permission);
      if (rows[0]) return rows[0].enabled;
    }
    return DEFAULTS[role]?.[permission] ?? false;
  }

  async assert(role: string, permission: PermissionKey) {
    if (!(await this.get(role, permission))) throw new ForbiddenException(`Permission denied: ${permission}`);
    return true;
  }

  async set(role: string, permission: PermissionKey, enabled: boolean) {
    await this.prisma.$executeRawUnsafe('INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("role","permission") DO UPDATE SET "enabled"=$4,"updatedAt"=CURRENT_TIMESTAMP', `rp_${role}_${permission}`, role, permission, enabled);
    return { role, permission, enabled };
  }
}
