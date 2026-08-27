import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PERMISSION_KEYS = ['WALLET_DEPOSIT', 'WALLET_WITHDRAWAL'] as const;
type PermissionKey = typeof PERMISSION_KEYS[number];

const DEFAULTS: Record<string, Record<PermissionKey, boolean>> = {
  SUPER_ADMIN: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true },
  ADMIN: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true },
  BRANCH_MANAGER: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true },
  TELLER: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true },
  STAFF: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: false },
  CUSTOMER_SERVICE: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: false },
  LOAN_OFFICER: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  CREDIT_OFFICER: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  AUDITOR: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  REGIONAL_MANAGER: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  DIVISIONAL_MANAGER: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  AREA_MANAGER: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  MONITORING_TEAM: { WALLET_DEPOSIT: false, WALLET_WITHDRAWAL: false },
  CUSTOMER: { WALLET_DEPOSIT: true, WALLET_WITHDRAWAL: true },
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

  async set(role: string, permission: PermissionKey, enabled: boolean) {
    await this.prisma.$executeRawUnsafe('INSERT INTO "RolePermission" ("id","role","permission","enabled","updatedAt") VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP) ON CONFLICT ("role","permission") DO UPDATE SET "enabled"=$4,"updatedAt"=CURRENT_TIMESTAMP', `rp_${role}_${permission}`, role, permission, enabled);
    return { role, permission, enabled };
  }
}
