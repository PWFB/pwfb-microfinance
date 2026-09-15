import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditWrite = {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  method: string;
  resource: string;
  recordId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  statusCode?: number | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditWrite) {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "AuditLog" ("actorId","actorEmail","actorRole","action","method","resource","recordId","details","ipAddress","userAgent","statusCode","createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,NOW())`,
        entry.actorId ?? null, entry.actorEmail ?? null, entry.actorRole ?? null,
        entry.action, entry.method, entry.resource, entry.recordId ?? null,
        JSON.stringify(entry.details ?? {}), entry.ipAddress ?? null, entry.userAgent ?? null,
        entry.statusCode ?? null,
      );
    } catch (error) {
      this.logger.error(`Audit write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async list(params: { page?: number; limit?: number; search?: string; action?: string; role?: string; from?: string; to?: string }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 25));
    const offset = (page - 1) * limit;
    const values: any[] = [];
    const where: string[] = [];
    const add = (value: any) => { values.push(value); return `$${values.length}`; };
    if (params.search) { const p = add(`%${params.search}%`); where.push(`("actorEmail" ILIKE ${p} OR "resource" ILIKE ${p} OR "action" ILIKE ${p} OR COALESCE("recordId",'') ILIKE ${p})`); }
    if (params.action) where.push(`"action" = ${add(params.action)}`);
    if (params.role) where.push(`"actorRole" = ${add(params.role)}`);
    if (params.from) where.push(`"createdAt" >= ${add(new Date(params.from))}`);
    if (params.to) where.push(`"createdAt" <= ${add(new Date(params.to))}`);
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM "AuditLog" ${clause}`, ...values);
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT "id","actorId","actorEmail","actorRole","action","method","resource","recordId","details","ipAddress","userAgent","statusCode","createdAt" FROM "AuditLog" ${clause} ORDER BY "createdAt" DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, ...values, limit, offset);
    const total = Number(countRows[0]?.count || 0);
    return { data: rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
}
