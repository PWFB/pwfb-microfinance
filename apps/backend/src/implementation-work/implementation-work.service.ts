import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED'] as const;
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const BASELINE = [
  { key: 'cashbook-api-security', module: 'Cashbook', title: 'Secure every cashbook API and apply branch/staff scope', description: 'Require JWT and role guards on every cashbook route; enforce branch/area visibility and immutable posted entries.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'officer-collection-ownership', module: 'Collections', title: 'Enforce credit-officer ownership and branch assignment', description: 'Bind each daily collection to the authenticated Staff ID and assigned branch. Prevent cross-branch customer and collection access.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'cash-collected-by-officer', module: 'Collections / Cashbook', title: 'Show cash collected by each credit officer', description: 'Display officer name, Staff ID, branch, count, collected amount, settled amount and unsettled amount. Branch totals must include only assigned branch officers.', priority: 'HIGH', status: 'IN_PROGRESS' },
  { key: 'cashbook-collector-link', module: 'Cashbook', title: 'Link settled cashbook entries to the collecting officer', description: 'Persist collector Staff ID on cashbook postings and preserve existing financial entries. Add a backward-compatible optional column and verify reconciliation.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'branch-area-report-scoping', module: 'Reports / Audit', title: 'Apply branch and area scope to reports and cumulative history', description: 'Branch Admin sees only their branch, Area Manager sees assigned area, and Super Admin retains organization-wide view. Ensure server-side filters.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'registration-fee-1500', module: 'Customers / Charges', title: 'Implement Super Admin-managed ₦1,500 registration charge', description: 'Require actual collection confirmation; retain the charged amount in immutable historical records, prevent duplicates and link the receipt to cashbook.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'cashbook-carry-forward', module: 'Cashbook', title: 'Automate previous cash-at-hand carry-forward', description: 'Carry forward only the previous day closing cash as the next opening cash; reset all other daily input fields and avoid duplicate daily rows.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'login-brute-force-controls', module: 'Authentication', title: 'Add persistent login throttling and account abuse controls', description: 'Rate-limit password, Google and passkey login attempts; protect against credential stuffing, brute force, enumeration and distributed retries.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'mandatory-step-up-funds', module: 'Authentication / Banking', title: 'Require step-up authentication for sensitive transfers', description: 'Require enforced MFA or passkey verification for privileged money movement, verify transaction intent and beneficiary, and reject replayed requests.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'transfer-idempotency-reconciliation', module: 'Banking', title: 'Harden transfer idempotency and ambiguous provider outcomes', description: 'Guarantee unique transfer request references, atomic wallet reservation, no blind retry on provider timeout, and auditable reconciliation/reversal.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'role-edit-permissions', module: 'Permissions', title: 'Enforce server-side edit permissions and immutable corrections', description: 'Only explicitly authorized roles may edit permitted records; posted financial entries use correcting/reversal entries and append-only audit events.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'staff-customer-branch-link', module: 'Staff / Customers', title: 'Verify staff assignment, customer ownership and role responsibilities', description: 'Ensure credit officers are linked by Staff ID to exactly their assigned branch and own customers/daily work; preserve historical reassignment context.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'end-to-end-security-verification', module: 'QA / Security', title: 'Run end-to-end access, login and funds-transfer security tests', description: 'Test cross-branch IDOR, role escalation, login abuse, MFA bypass, replay, double settlement, concurrent withdrawals, provider timeouts and audit coverage.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'frontend-api-acceptance', module: 'Frontend / API', title: 'Complete frontend integration and role-by-role acceptance checks', description: 'Verify every affected screen calls scoped APIs, displays collector/Staff ID and branch totals, and has useful permission/error states for each role.', priority: 'MEDIUM', status: 'NOT_STARTED' },
] as const;

@Injectable()
export class ImplementationWorkService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTables() {
    if (!this.ready) {
      this.ready = this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ImplementationWorkItem" (
          "id" TEXT PRIMARY KEY,
          "workKey" TEXT UNIQUE,
          "title" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "module" TEXT NOT NULL,
          "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
          "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
          "assignedTo" TEXT,
          "verificationNotes" TEXT,
          "evidenceUrl" TEXT,
          "createdBy" TEXT,
          "updatedBy" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ImplementationWorkItem_status_idx" ON "ImplementationWorkItem" ("status");
        CREATE INDEX IF NOT EXISTS "ImplementationWorkItem_module_idx" ON "ImplementationWorkItem" ("module");
        CREATE TABLE IF NOT EXISTS "ImplementationWorkEvent" (
          "id" TEXT PRIMARY KEY,
          "workItemId" TEXT NOT NULL REFERENCES "ImplementationWorkItem"("id") ON DELETE CASCADE,
          "actorId" TEXT,
          "actorEmail" TEXT,
          "action" TEXT NOT NULL,
          "previousStatus" TEXT,
          "newStatus" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "ImplementationWorkEvent_workItemId_createdAt_idx" ON "ImplementationWorkEvent" ("workItemId", "createdAt");
      `).then(() => undefined).catch(error => { this.ready = null; throw error; });
    }
    await this.ready;
    for (const item of BASELINE) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "ImplementationWorkItem" ("id","workKey","title","description","module","priority","status","createdBy","updatedBy") VALUES ($1,$2,$3,$4,$5,$6,$7,'SYSTEM','SYSTEM') ON CONFLICT ("workKey") DO NOTHING`,
        randomUUID(), item.key, item.title, item.description, item.module, item.priority, item.status,
      );
    }
  }

  async list(filters: { status?: string; module?: string } = {}) {
    await this.ensureTables();
    const status = filters.status?.trim().toUpperCase();
    if (status && !STATUSES.includes(status as any)) throw new BadRequestException('Invalid work status');
    return this.prisma.$queryRawUnsafe(
      `SELECT w.*,
        (SELECT COUNT(*)::int FROM "ImplementationWorkEvent" e WHERE e."workItemId"=w.id) AS "eventCount"
       FROM "ImplementationWorkItem" w
       WHERE ($1::text IS NULL OR w."status"=$1)
         AND ($2::text IS NULL OR LOWER(w."module")=LOWER($2))
       ORDER BY CASE w."priority" WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         CASE w."status" WHEN 'IN_PROGRESS' THEN 0 WHEN 'BLOCKED' THEN 1 WHEN 'NOT_STARTED' THEN 2 WHEN 'IN_REVIEW' THEN 3 ELSE 4 END,
         w."updatedAt" DESC`,
      status || null, filters.module?.trim() || null,
    );
  }

  async create(input: any, actor: any) {
    await this.ensureTables();
    const title = String(input?.title || '').trim();
    const description = String(input?.description || '').trim();
    const module = String(input?.module || '').trim();
    const priority = String(input?.priority || 'MEDIUM').toUpperCase();
    if (!title || !description || !module) throw new BadRequestException('Title, description and module are required');
    if (!PRIORITIES.includes(priority as any)) throw new BadRequestException('Invalid work priority');
    const id = randomUUID();
    await this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(
        `INSERT INTO "ImplementationWorkItem" ("id","title","description","module","priority","status","assignedTo","createdBy","updatedBy") VALUES ($1,$2,$3,$4,$5,'NOT_STARTED',$6,$7,$7)`,
        id, title, description, module, priority, String(input.assignedTo || '').trim() || null, actor?.id || null,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "ImplementationWorkEvent" ("id","workItemId","actorId","actorEmail","action","note") VALUES ($1,$2,$3,$4,'CREATED',$5)`,
        randomUUID(), id, actor?.id || null, actor?.email || null, 'Work item created',
      );
    });
    return this.get(id);
  }

  async get(id: string) {
    await this.ensureTables();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "ImplementationWorkItem" WHERE "id"=$1 LIMIT 1`, id);
    if (!rows[0]) throw new NotFoundException('Implementation work item not found');
    return rows[0];
  }

  async update(id: string, input: any, actor: any) {
    await this.ensureTables();
    const current = await this.get(id);
    const allowed: Record<string, string | null> = {};
    if (input?.status !== undefined) {
      const status = String(input.status).toUpperCase();
      if (!STATUSES.includes(status as any)) throw new BadRequestException('Invalid work status');
      allowed.status = status;
    }
    if (input?.priority !== undefined) {
      const priority = String(input.priority).toUpperCase();
      if (!PRIORITIES.includes(priority as any)) throw new BadRequestException('Invalid work priority');
      allowed.priority = priority;
    }
    if (input?.assignedTo !== undefined) allowed.assignedTo = String(input.assignedTo).trim() || null;
    if (input?.verificationNotes !== undefined) allowed.verificationNotes = String(input.verificationNotes).trim() || null;
    if (input?.evidenceUrl !== undefined) {
      const value = String(input.evidenceUrl).trim();
      if (value && !/^https:\/\//i.test(value)) throw new BadRequestException('Evidence URL must use HTTPS');
      allowed.evidenceUrl = value || null;
    }
    if (!Object.keys(allowed).length) throw new BadRequestException('Provide a supported work update');
    const columns = Object.keys(allowed);
    const params: any[] = [id, actor?.id || null];
    const assignments = columns.map((key, index) => {
      params.push(allowed[key]);
      return `"${key}"=$${index + 3}`;
    });
    assignments.push('"updatedBy"=$2', '"updatedAt"=CURRENT_TIMESTAMP');
    const nextStatus = allowed.status || current.status;
    const statusChanged = nextStatus !== current.status;
    const note = String(input?.note || input?.verificationNotes || '').trim() || null;
    await this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`UPDATE "ImplementationWorkItem" SET ${assignments.join(',')} WHERE "id"=$1`, ...params);
      await tx.$executeRawUnsafe(
        `INSERT INTO "ImplementationWorkEvent" ("id","workItemId","actorId","actorEmail","action","previousStatus","newStatus","note") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        randomUUID(), id, actor?.id || null, actor?.email || null, statusChanged ? 'STATUS_CHANGED' : 'UPDATED', current.status, nextStatus, note,
      );
    });
    return this.get(id);
  }

  async history(id: string) {
    await this.get(id);
    return this.prisma.$queryRawUnsafe(
      `SELECT "id","actorId","actorEmail","action","previousStatus","newStatus","note","createdAt" FROM "ImplementationWorkEvent" WHERE "workItemId"=$1 ORDER BY "createdAt" ASC`,
      id,
    );
  }
}
