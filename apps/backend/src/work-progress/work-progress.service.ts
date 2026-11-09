import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'PARTIAL', 'VERIFIED', 'COMPLETED'] as const;
const DEFAULT_TASKS = [
  { id: 'branch-ownership', title: 'Branch and credit-officer ownership', status: 'PARTIAL', description: 'Existing customer, loan, savings, collection, repayment, transaction and report reads are scoped; loan/savings destination-customer changes now check the new customer scope. Legacy customer branch/officer/group assignments are locked once populated; only Super Admin may backfill missing links, and staff/group branch consistency is checked.', nextStep: 'Pass fresh backend tests, then run role-by-role cross-branch and same-branch isolation tests against real branch fixtures.' },
  { id: 'customer-registration-assignment', title: 'Customer origin branch, officer and group assignment', status: 'PARTIAL', description: 'New registrations derive branch and Staff ID from the authenticated staff member. Existing populated origin branch, assigned officer and group fields can no longer be reassigned; a Super Admin can only backfill missing values after branch/officer/group consistency checks.', nextStep: 'Verify customer profile shows branch, assigned officer and group for new and approved backfilled legacy records without changing existing populated assignments.' },
  { id: 'cashbook-security', title: 'Cashbook security and cash attribution', status: 'PARTIAL', description: 'Daily cashbook postings now serialize by branch and staff, reject duplicate dates and out-of-order work, validate financial-period dates and derive opening/closing cash from stored records. Manual ledger references are serialized and deduplicated; branch virtual-account manual entries are branch-scoped and require an existing open period and bank/provider reference. Latest changes await a fresh CI run and seeded branch reconciliation.', nextStep: 'Pass fresh backend tests, then reconcile multiple-day staff cashbooks and branch deposits against verified wallet/provider settlements.' },
  { id: 'teller-separation-of-duties', title: 'Teller financial separation of duties', status: 'PARTIAL', description: 'Teller defaults and hard permission checks now deny wallet withdrawals, bank transfers, savings withdrawals, loan creation and loan disbursement, including stale stored permission rows. Teller daily cashbook is receipt-only; branch virtual-account manual posting is no longer a teller endpoint. Banking staff attribution also resolves through the authenticated Staff.userId link and requires an active staff record.', nextStep: 'Pass fresh CI, then verify branch-scoped teller cash receipts and ensure the pending approved bulk repayment flow remains usable without enabling prohibited withdrawals or transfers.' },
  { id: 'authentication-hardening', title: 'Login and staff second-factor protection', status: 'IN_PROGRESS', description: 'Persistent login-failure throttling and mandatory staff authenticator enrollment are implemented on the feature branch.', nextStep: 'Verify enrollment, TOTP verification, recovery, lockout expiry and account recovery in staging.' },
  { id: 'customer-staff-profile', title: 'Customer and staff view-only profiles', status: 'IN_PROGRESS', description: 'Expose authenticated self-profile endpoints and a shared view-only profile page.', nextStep: 'Validate staff/customer profile fields and verify no sensitive BVN, password or recovery data is returned.' },
  { id: 'registration-fee', title: 'Central customer registration charge', status: 'NOT_STARTED', description: 'Implement the Super Admin-managed registration charge with immutable change history and a confirmed receipt linked to customer, Staff ID, branch and cashbook. The accepted current default is ₦1,500 per client.', nextStep: 'Add a central charge configuration and audit trail, then require confirmed collection before completing registration.' },
  { id: 'bulk-payment', title: 'Teller bulk-payment workflow', status: 'NOT_STARTED', description: 'Prepare batches, verify loan and beneficiary account details, show duplicates and totals, then require separate authorization and idempotent processing.', nextStep: 'Implement preview, approval, execution, provider reconciliation and partial-failure recovery.' },
  { id: 'group-loans', title: 'Individual and group customer/loan workflow', status: 'NOT_STARTED', description: 'Support registering individual or group clients and selecting individual or group membership during loan creation.', nextStep: 'Confirm group repayment, guarantor and disbursement accounting semantics before implementation.' },
  { id: 'daily-repayment-status', title: 'Daily installment repayment status', status: 'PARTIAL', description: 'The daily register now includes only DISBURSED daily-frequency loans. Confirmed late repayments are applied to the oldest outstanding installment so a paid installment does not remain overdue. The green paid/red unpaid UI exists; fresh CI and assigned-role browser acceptance remain outstanding.', nextStep: 'Verify schedule allocation for partial, late, same-day and excess payments against saved repayment records, then confirm role-specific daily register visibility.' },
  { id: 'end-to-end-validation', title: 'Full integration, security and regression verification', status: 'IN_PROGRESS', description: 'Earlier CI passed, but new cashbook serialization, repayment allocation, Teller permissions, staff attribution and branch-deposit changes were added after that checkpoint. The latest code still needs a fresh full Actions run and role-specific financial reconciliation before release.', nextStep: 'Re-run the full PR build/test workflow on the latest branch head, resolve every backend/frontend failure, then execute branch, officer, teller and super-admin acceptance tests.' },
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
