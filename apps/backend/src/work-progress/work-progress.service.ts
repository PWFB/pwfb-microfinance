import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'PARTIAL', 'VERIFIED', 'COMPLETED'] as const;
const DEFAULT_TASKS = [
  { id: 'branch-ownership', title: 'Branch and credit-officer ownership', status: 'IN_PROGRESS', description: 'Enforce branch and assigned-staff ownership for customer, loan, savings, collections, repayments, transaction ledger and report queries.', nextStep: 'Run role-by-role cross-branch and same-branch isolation tests, including single-record transaction and collection lookups.' },
  { id: 'cashbook-security', title: 'Cashbook security and cash attribution', status: 'IN_PROGRESS', description: 'Guard all cashbook routes and attribute field cash/deposits to the authenticated staff member and branch.', nextStep: 'Verify cashbook totals against wallet deposits and daily field cash with seeded branch fixtures.' },
  { id: 'authentication-hardening', title: 'Login and staff second-factor protection', status: 'IN_PROGRESS', description: 'Persistent login-failure throttling and mandatory staff authenticator enrollment are implemented on the feature branch.', nextStep: 'Verify enrollment, TOTP verification, recovery, lockout expiry and account recovery in staging.' },
  { id: 'customer-staff-profile', title: 'Customer and staff view-only profiles', status: 'IN_PROGRESS', description: 'Expose authenticated self-profile endpoints and a shared view-only profile page.', nextStep: 'Validate staff/customer profile fields and verify no sensitive BVN, password or recovery data is returned.' },
  { id: 'bulk-payment', title: 'Teller bulk-payment workflow', status: 'NOT_STARTED', description: 'Prepare batches, verify loan and beneficiary account details, show duplicates and totals, then require separate authorization and idempotent processing.', nextStep: 'Implement preview, approval, execution, provider reconciliation and partial-failure recovery.' },
  { id: 'group-loans', title: 'Individual and group customer/loan workflow', status: 'NOT_STARTED', description: 'Support registering individual or group clients and selecting individual or group membership during loan creation.', nextStep: 'Confirm group repayment, guarantor and disbursement accounting semantics before implementation.' },
  { id: 'daily-repayment-status', title: 'Daily installment repayment status', status: 'PARTIAL', description: 'Loan repayment schedules already calculate paid, due and overdue amounts; daily assignment visibility and final UI indicators need end-to-end validation.', nextStep: 'Connect daily schedule items to confirmed repayments and show green paid / red unpaid to assigned roles.' },
  { id: 'end-to-end-validation', title: 'Full integration, security and regression verification', status: 'NOT_STARTED', description: 'Run backend tests, frontend build, role-isolation tests, financial reconciliation and security checks before staging release.', nextStep: 'Run CI on this branch and fix all failures before creating a release candidate.' },
];

@Injectable()
export class WorkProgressService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private async ensureTable() {
    if (!this.ready) this.ready = this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "WorkProgress" (
        "id" TEXT PRIMARY KEY,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
        "nextStep" TEXT NOT NULL DEFAULT '',
        "evidence" TEXT NOT NULL DEFAULT '',
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "WorkProgress_status_updated_idx" ON "WorkProgress" ("status", "updatedAt" DESC);
    `).then(async () => {
      for (const task of DEFAULT_TASKS) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "WorkProgress" ("id","title","description","status","nextStep") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("id") DO NOTHING`,
          task.id, task.title, task.description, task.status, task.nextStep,
        );
      }
    }).catch((error) => { this.ready = null; throw error; });
    await this.ready;
  }

  async list() {
    await this.ensureTable();
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","description","status","nextStep","evidence","updatedBy","createdAt","updatedAt" FROM "WorkProgress" ORDER BY CASE "status" WHEN 'IN_PROGRESS' THEN 1 WHEN 'BLOCKED' THEN 2 WHEN 'PARTIAL' THEN 3 WHEN 'NOT_STARTED' THEN 4 WHEN 'VERIFIED' THEN 5 ELSE 6 END, "updatedAt" DESC`,
    );
  }

  async create(input: { title?: string; description?: string; nextStep?: string }, userId: string) {
    await this.ensureTable();
    const title = String(input?.title || '').trim();
    if (!title) throw new BadRequestException('A task title is required');
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "WorkProgress" ("id","title","description","nextStep","updatedBy") VALUES ($1,$2,$3,$4,$5)`,
      id, title, String(input.description || ''), String(input.nextStep || ''), userId,
    );
    return this.findOne(id);
  }

  async findOne(id: string) {
    await this.ensureTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","title","description","status","nextStep","evidence","updatedBy","createdAt","updatedAt" FROM "WorkProgress" WHERE "id"=$1 LIMIT 1`, id,
    );
    if (!rows[0]) throw new NotFoundException('Work-progress item not found');
    return rows[0];
  }

  async update(id: string, input: { status?: string; nextStep?: string; evidence?: string; description?: string }, userId: string) {
    await this.ensureTable();
    const status = input.status === undefined ? undefined : String(input.status).toUpperCase();
    if (status && !STATUSES.includes(status as typeof STATUSES[number])) throw new BadRequestException('Invalid work-progress status');
    await this.findOne(id);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "WorkProgress" SET "status"=COALESCE($2,"status"), "nextStep"=COALESCE($3,"nextStep"), "evidence"=COALESCE($4,"evidence"), "description"=COALESCE($5,"description"), "updatedBy"=$6, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
      id, status ?? null, input.nextStep === undefined ? null : String(input.nextStep), input.evidence === undefined ? null : String(input.evidence), input.description === undefined ? null : String(input.description), userId,
    );
    return this.findOne(id);
  }
}
