import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'PARTIAL', 'VERIFIED', 'COMPLETED'] as const;
const DEFAULT_TASKS = [
  { id: 'branch-ownership', title: 'Branch and credit-officer ownership', status: 'PARTIAL', description: 'Existing customer, loan, savings, collection, repayment, transaction and report reads are scoped; loan/savings destination-customer changes now check the new customer scope. Legacy customer branch/officer/group assignments are locked once populated; only Super Admin may backfill missing links, and staff/group branch consistency is checked.', nextStep: 'Pass fresh backend tests, then run role-by-role cross-branch and same-branch isolation tests against real branch fixtures.' },
  { id: 'customer-registration-assignment', title: 'Customer origin branch, officer and group assignment', status: 'PARTIAL', description: 'New registrations derive branch and Staff ID from the authenticated staff member. Existing populated origin branch, assigned officer and group fields can no longer be reassigned; a Super Admin can only backfill missing values after branch/officer/group consistency checks.', nextStep: 'Verify customer profile shows branch, assigned officer and group for new and approved backfilled legacy records without changing existing populated assignments.' },
  { id: 'cashbook-security', title: 'Cashbook security and cash attribution', status: 'PARTIAL', description: 'Daily cashbook postings now serialize by branch and staff, reject duplicate dates and out-of-order work, validate financial-period dates and derive opening/closing cash from stored records. Manual ledger references are serialized and deduplicated; branch virtual-account manual entries are branch-scoped and require an existing open period and bank/provider reference. Latest CI identified eight TypeScript errors caused by generic type arguments on transaction-client raw queries; those calls were corrected without changing SQL or accounting behavior. Fresh CI is required.', nextStep: 'Pass fresh backend build/tests after the transaction raw-query typing repair, then reconcile multiple-day staff cashbooks and branch deposits against verified wallet/provider settlements.' },
  { id: 'teller-separation-of-duties', title: 'Teller financial separation of duties', status: 'PARTIAL', description: 'Teller defaults and hard permission checks now deny wallet withdrawals, bank transfers, savings withdrawals, loan creation and loan disbursement, including stale stored permission rows. Teller daily cashbook is receipt-only; branch virtual-account manual posting is no longer a teller endpoint. Banking staff attribution also resolves through the authenticated Staff.userId link and requires an active staff record.', nextStep: 'Pass fresh CI, then verify branch-scoped teller cash receipts and ensure the pending approved bulk repayment flow remains usable without enabling prohibited withdrawals or transfers.' },
  { id: 'authentication-hardening', title: 'Login and staff second-factor protection', status: 'IN_PROGRESS', description: 'Persistent login-failure throttling and mandatory staff authenticator enrollment are implemented on the feature branch.', nextStep: 'Verify enrollment, TOTP verification, recovery, lockout expiry and account recovery in staging.' },
  { id: 'customer-staff-profile', title: 'Customer and staff view-only profiles', status: 'PARTIAL', description: 'Authenticated staff/customer self-profile endpoints and the shared profile page exist. Customer My Profile now exposes consent-based self-service BVN/NIN verification and displays masked identifiers/status only. Staff and customer profile API output avoids full identity values and sensitive credentials.', nextStep: 'Verify customer and staff profiles against real branch and account fixtures and confirm customer role cannot access another customer identity record.' },
  { id: 'bvn-nin-verification', title: 'BVN and NIN identity verification', status: 'PARTIAL', description: 'Existing Paystack consent-based BVN bank-account validation remains supported for DVA provisioning. A separate Dojah BVN/NIN provider flow now requires explicit consent, 11-digit validation, matching legal-name tokens AND an exact date-of-birth match (missing DOB fails closed), masked-only identifier storage, provider references, and an audit record for successful, mismatched, failed and unavailable/network-error outcomes. Customer self-service and scoped staff-assisted APIs plus customer profile controls are wired. Automated provider tests use mocked sandbox responses; live Dojah credentials, live provider verification and staging account acceptance are not yet confirmed.', nextStep: 'Configure DOJAH_APP_ID and DOJAH_SECRET_KEY in Render staging, keep DOJAH_ENVIRONMENT=sandbox first, run real consent-based BVN and NIN test cases, verify exact-name/DOB mismatch and provider timeout/unavailable paths, then only consider approved live credentials. Never enable disbursement gating until compliance approves whether BVN, NIN or either is mandatory.' },
  { id: 'registration-fee', title: 'Central customer registration charge', status: 'PARTIAL', description: 'Backend central charge configuration now defaults to ₦1,500 per client. Only Super Admin can change it, with immutable old/new amount, reason, actor and timestamp history. Receipt collection is branch/collector attributed, reference-idempotent, staff-attested and posts a CASH_IN cashbook entry; customer creation atomically consumes one unused receipt and records both collecting Teller and registering officer. Customer add UI and Super Admin charge settings UI are connected. Current receipts explicitly remain providerVerified=false until bank settlement integration is added.', nextStep: 'Pass fresh backend/frontend CI, validate Teller-to-Credit-Officer receipt handoff with seeded branches, and reconcile fee receipts to branch cashbook records.' },
  { id: 'bulk-payment', title: 'Teller bulk-payment workflow', status: 'NOT_STARTED', description: 'Prepare batches, verify loan and beneficiary account details, show duplicates and totals, then require separate authorization and idempotent processing.', nextStep: 'Implement preview, approval, execution, provider reconciliation and partial-failure recovery.' },
  { id: 'group-loans', title: 'Individual and group customer/loan workflow', status: 'NOT_STARTED', description: 'Support registering individual or group clients and selecting individual or group membership during loan creation.', nextStep: 'Confirm group repayment, guarantor and disbursement accounting semantics before implementation.' },
  { id: 'daily-repayment-status', title: 'Daily installment repayment status', status: 'PARTIAL', description: 'The daily register now includes only DISBURSED daily-frequency loans. Confirmed late repayments are applied to the oldest outstanding installment so a paid installment does not remain overdue. The green paid/red unpaid UI exists; fresh CI and assigned-role browser acceptance remain outstanding.', nextStep: 'Verify schedule allocation for partial, late, same-day and excess payments against saved repayment records, then confirm role-specific daily register visibility.' },
  { id: 'end-to-end-validation', title: 'Full integration, security and regression verification', status: 'IN_PROGRESS', description: 'Earlier build/test checkpoints exposed and drove repairs to new regression fixtures. Cashbook serialization, repayment allocation, Teller permissions, staff attribution, branch-deposit controls, collection scoping, and BVN/NIN code have since been added. Latest Actions run failed at backend compilation because tx was typed any while eight $queryRawUnsafe calls supplied type arguments; the eight calls in charges.service.ts and staff-wallet.service.ts have been corrected. Current head requires fresh full Actions, frontend build, real-provider staging checks and role-specific financial reconciliation before release.', nextStep: 'Run full backend/frontend Actions on the latest PR head and verify the eight transaction-query typing fixes; repair further failures, then execute branch, officer, teller, customer KYC, Super Admin and finance reconciliation acceptance tests.' },
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
          `INSERT INTO "WorkProgress" ("id","title","description","status","nextStep") VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT ("id") DO UPDATE SET
             "title"=EXCLUDED."title",
             "description"=EXCLUDED."description",
             "nextStep"=EXCLUDED."nextStep",
             "status"=CASE WHEN "WorkProgress"."status"='NOT_STARTED' THEN EXCLUDED."status" ELSE "WorkProgress"."status" END,
             "updatedAt"=CURRENT_TIMESTAMP
           WHERE "WorkProgress"."status"='NOT_STARTED'`,
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
