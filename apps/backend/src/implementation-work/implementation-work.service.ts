import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'COMPLETED'] as const;
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

const BASELINE = [
  { key: 'cashbook-api-security', module: 'Cashbook', title: 'Secure every cashbook API and apply branch/staff scope', description: 'Require JWT and role guards on every cashbook route; enforce branch/area visibility and immutable posted entries.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'officer-collection-ownership', module: 'Collections', title: 'Enforce credit-officer ownership and branch assignment', description: 'Bind each daily collection to the authenticated Staff ID and assigned branch. Prevent cross-branch customer and collection access.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'cash-collected-by-officer', module: 'Collections / Cashbook', title: 'Show cash collected by each credit officer', description: 'Daily officer totals combine field collection records and completed wallet cash deposits, with Staff ID, branch, collection count, deposit count, collected, settled and unsettled amounts. Branch totals use assigned branch scope.', priority: 'HIGH', status: 'IN_PROGRESS' },
  { key: 'cashbook-collector-link', module: 'Cashbook', title: 'Link settled cashbook entries to the collecting officer', description: 'Persist collector Staff ID on cashbook postings and preserve existing financial entries. Add a backward-compatible optional column and verify reconciliation.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'branch-area-report-scoping', module: 'Reports / Audit', title: 'Apply branch and area scope to reports and cumulative history', description: 'Branch-scoped reports, operations, reconciliation and audit history are now implemented; continue verifying all dashboards and direct-ID routes.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'registration-fee-1500', module: 'Customers / Charges', title: 'Implement Super Admin-managed ₦1,500 registration charge', description: 'Require actual collection confirmation; retain the charged amount in immutable historical records, prevent duplicates and link the receipt to cashbook.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'cashbook-carry-forward', module: 'Cashbook', title: 'Automate previous cash-at-hand carry-forward', description: 'Carry forward only the previous day closing cash as the next opening cash; reset all other daily input fields and avoid duplicate daily rows.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'login-brute-force-controls', module: 'Authentication', title: 'Add persistent login throttling and account abuse controls', description: 'Database-backed password-login rate limits are in progress; extend abuse controls to Google and passkey endpoints and verify production proxy/IP behavior.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'mandatory-step-up-funds', module: 'Authentication / Banking', title: 'Require step-up authentication for sensitive transfers', description: 'Authenticator MFA is enforced for wallet transfers/withdrawals, loan disbursement approval, payroll payouts, savings withdrawals, staff-wallet cash and card charges; verify every remaining financial route and enrollment UX.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'transfer-idempotency-reconciliation', module: 'Banking', title: 'Harden transfer idempotency and ambiguous provider outcomes', description: 'Collection settlement and loan disbursement now claim records before movement to block concurrent duplicate processing; complete provider idempotency and manual reconciliation workflows.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'role-edit-permissions', module: 'Permissions', title: 'Enforce server-side edit permissions and immutable corrections', description: 'Only explicitly authorized roles may edit permitted records; posted financial entries use correcting/reversal entries and append-only audit events.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'staff-customer-branch-link', module: 'Staff / Customers', title: 'Verify staff assignment, customer ownership and role responsibilities', description: 'Ensure credit officers are linked by Staff ID to exactly their assigned branch and own customers/daily work; preserve historical reassignment context.', priority: 'HIGH', status: 'NOT_STARTED' },
  { key: 'end-to-end-security-verification', module: 'QA / Security', title: 'Run end-to-end access, login and funds-transfer security tests', description: 'Test cross-branch IDOR, role escalation, login abuse, MFA bypass, replay, double settlement, concurrent withdrawals, provider timeouts and audit coverage.', priority: 'CRITICAL', status: 'NOT_STARTED' },
  { key: 'payroll-route-authorization', module: 'Payroll', title: 'Secure payroll and prevent duplicate salary payments', description: 'JWT/role guards, branch scoping, MFA for approval/payment, staff-to-payroll branch checks and row-locked one-time salary settlement added; complete tests and audit history.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'staff-wallet-and-savings-mfa', module: 'Staff Wallet / Savings', title: 'Require MFA and atomic balance controls for internal cash movements', description: 'MFA gates added to staff-wallet issue/settle and savings withdrawal; row locking protects savings from concurrent overdrafts. Verify all roles and frontend enrollment.', priority: 'HIGH', status: 'IN_PROGRESS' },
  { key: 'transaction-ledger-branch-scope', module: 'Transactions', title: 'Restrict transaction history and manual ledger entries by customer ownership', description: 'Ledger and wallet transaction history now filters by assigned branch and credit-officer customers; manual ledger writes require MFA. Verify direct record IDs and all transaction routes.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'reconciliation-branch-area-scope', module: 'Reconciliation', title: 'Apply branch/area filters to every reconciliation aggregate', description: 'Reconciliation filters collections, cashbook, savings, loans, repayments, payroll and staff wallets by all assigned branch IDs; head-office balance is Super Admin only. Verify with multiple branches.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'branch-audit-history', module: 'Audit', title: 'Provide branch-only cumulative audit history', description: 'Audit history is available to Super Admin/Auditor and assigned branch or area managers; log records are filtered by branch details and staff actors. Validate coverage for actions without branch IDs.', priority: 'HIGH', status: 'IN_PROGRESS' },
  { key: 'teller-branch-cash-desk', module: 'Teller / Banking', title: 'Complete Teller branch cash-desk workflow', description: 'Teller serves customers only within the assigned branch, receives and attests physical cash, requires MFA, cannot withdraw/transfer or approve payouts, and posts wallet plus cashbook receipts with its Staff ID.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'asset-loan-manager-review', module: 'Loans / Asset Review', title: 'Complete independent Asset Loan Manager review', description: 'Asset Loan Manager can review Individual Loan applications in its assigned branch only; no self-approval; review note and reviewer Staff ID are stored; Branch Manager final payout remains separately MFA-approved.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'cash-deposit-atomic-posting', module: 'Banking / Cashbook', title: 'Atomically post Teller cash deposits', description: 'Verify same-branch customer and active collector, require cash-received confirmation and open period, then atomically credit the wallet and create a matching CASH_IN cashbook entry with Staff ID and a unique transaction reference.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'cashbook-field-work-attribution', module: 'Cashbook', title: 'Display Staff ID across daily field work and posted cashbook entries', description: 'Daily register rows and ordinary posted receipts include collector Staff ID/name. Individual officers see own daily records; branch/area managers see all assigned staff. Posted wallet deposits remain separate from daily-register totals to prevent double counting.', priority: 'HIGH', status: 'IN_PROGRESS' },
  { key: 'financial-period-route-security', module: 'Periods / Security', title: 'Secure financial-period operations', description: 'Require authentication on all period routes, Admin/Super Admin plus MFA to create or close periods, allow staff read-only access, and serialize creation/closure to avoid competing open periods.', priority: 'CRITICAL', status: 'IN_PROGRESS' },
  { key: 'teller-customer-service-scope', module: 'Teller / Access Control', title: 'Separate Teller branch customer service from Credit Officer ownership', description: 'Teller can find and receive cash for customers in its own branch; cannot view another branch; Credit Officers remain restricted to their individually assigned clients and no staff can edit daily field work.', priority: 'HIGH', status: 'IN_PROGRESS' },
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
    // Refresh only baseline-owned rows; keep any user-updated work status intact.
    await this.prisma.$executeRawUnsafe(
      `UPDATE "ImplementationWorkItem" SET "title"=$1,"description"=$2,"priority"='HIGH',"status"='IN_PROGRESS',"updatedAt"=CURRENT_TIMESTAMP WHERE "workKey"='cashbook-collector-link' AND "updatedBy"='SYSTEM'`,
      'Link settled cashbook entries to the collecting officer',
      'Cashbook postings now retain the Staff ID for manual deposits, settled collections and registration fees; verify historic postings and reconciliation.',
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE "ImplementationWorkItem" SET "title"=$1,"description"=$2,"priority"='HIGH',"status"='IN_PROGRESS',"updatedAt"=CURRENT_TIMESTAMP WHERE "workKey"='registration-fee-1500' AND "updatedBy"='SYSTEM'`,
      'Implement Super Admin-managed ₦1,500 registration charge',
      'Charge is centrally configured by Super Admin, actual collection attestation required, historical receipt amount retained, duplicate charge prevented and receipt linked to cashbook. Complete end-to-end acceptance testing.',
    );
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
