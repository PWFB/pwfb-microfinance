import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { createFinancialReference } from '../common/financial-reference';

@Injectable()
export class StaffWalletService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}

  async ensureTables(db: any = this.prisma) {
    if (db !== this.prisma) {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS staff_wallets (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE, branch_id TEXT NOT NULL REFERENCES "Branch"(id), balance DOUBLE PRECISION NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS staff_wallet_transactions (id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE, type TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL, previous_balance DOUBLE PRECISION NOT NULL, new_balance DOUBLE PRECISION NOT NULL, reference TEXT, description TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx ON staff_wallet_transactions(wallet_id, created_at DESC);`);
      return;
    }
    if (!this.ready) {
      this.ready = this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS staff_wallets (id TEXT PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE, branch_id TEXT NOT NULL REFERENCES "Branch"(id), balance DOUBLE PRECISION NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'NGN', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS staff_wallet_transactions (id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE, type TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL, previous_balance DOUBLE PRECISION NOT NULL, new_balance DOUBLE PRECISION NOT NULL, reference TEXT, description TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx ON staff_wallet_transactions(wallet_id, created_at DESC);`).then(() => undefined).catch((e) => { this.ready = null; throw e; });
    }
    await this.ready;
  }

  private async ensureUniqueReference(db: any, reference?: string) {
    const normalized = String(reference ?? '').trim();
    if (!normalized) return;
    // Serialize writes sharing a reference inside the transaction, so concurrent
    // duplicate requests cannot both pass the existence check.
    await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', normalized);
    const existing: any[] = await db.$queryRawUnsafe(
      'SELECT id FROM staff_wallet_transactions WHERE reference=$1 LIMIT 1',
      normalized,
    );
    if (existing.length) throw new BadRequestException('Staff wallet transaction reference already exists');
  }

  private amount(value: unknown) { const n = Number(value ?? 0); if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Wallet amount must be greater than zero'); const rounded = Math.round((n + Number.EPSILON) * 100) / 100; if (rounded <= 0) throw new BadRequestException('Wallet amount must be at least ₦0.01'); return rounded; }

  private async staff(staffId: string, db: any = this.prisma) {
    const rows: any[] = await db.$queryRawUnsafe(`SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance FROM staff_wallets WHERE staff_id=$1`, staffId);
    if (rows[0]) return rows[0];
    const staffRows: any[] = await db.$queryRawUnsafe(`SELECT id, "staffId", "branchId", "firstName", "lastName", "position", "employmentStatus" FROM "Staff" WHERE id=$1`, staffId);
    if (!staffRows[0]) throw new NotFoundException('Staff member not found');
    if (staffRows[0].employmentStatus !== 'ACTIVE') throw new BadRequestException('Only active staff can hold a field wallet');
    const id = randomUUID();
    await db.$executeRawUnsafe(`INSERT INTO staff_wallets (id, staff_id, branch_id) VALUES ($1,$2,$3) ON CONFLICT (staff_id) DO NOTHING`, id, staffId, staffRows[0].branchId);
    const created: any[] = await db.$queryRawUnsafe(`SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance FROM staff_wallets WHERE staff_id=$1`, staffId);
    return created[0];
  }

  async list(user: any, branchId?: string) {
    await this.ensureTables();
    const scope = await this.accessScope.getScope(user);
    if (scope.global) {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT w.id, w.staff_id AS "staffId", w.branch_id AS "branchId", w.balance, w.currency, s."firstName", s."middleName", s."lastName", s."position", s."employmentStatus", b.name AS "branchName" FROM staff_wallets w JOIN "Staff" s ON s.id=w.staff_id JOIN "Branch" b ON b.id=w.branch_id ${branchId ? 'WHERE w.branch_id=$1' : ''} ORDER BY s."firstName", s."lastName"`,
        ...(branchId ? [branchId] : []),
      );
      return rows;
    }
    const branchIds = await this.accessScope.getScopedBranchIds(user) || [];
    if (branchId && !branchIds.includes(branchId)) {
      await this.accessScope.assertBranch(user, branchId);
      throw new BadRequestException('Requested branch is outside your assigned scope');
    }
    const allowed = branchId ? [branchId] : branchIds;
    if (!allowed.length) return [];
    return this.prisma.$queryRawUnsafe(
      `SELECT w.id, w.staff_id AS "staffId", w.branch_id AS "branchId", w.balance, w.currency, s."firstName", s."middleName", s."lastName", s."position", s."employmentStatus", b.name AS "branchName" FROM staff_wallets w JOIN "Staff" s ON s.id=w.staff_id JOIN "Branch" b ON b.id=w.branch_id WHERE w.branch_id = ANY($1::text[]) ORDER BY s."firstName", s."lastName"`,
      allowed,
    );
  }

  async get(staffId: string, user: any) {
    await this.accessScope.assertStaff(user, staffId);
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    const transactions: any[] = await this.prisma.$queryRawUnsafe(`SELECT id, type, amount, previous_balance AS "previousBalance", new_balance AS "newBalance", reference, description, created_at AS "createdAt" FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 100`, wallet.id);
    return { ...wallet, transactions };
  }

  async creditForUser(user: any, staffId: string, amountValue: number, reference?: string, description = 'Field cash issued to staff') {
    await this.accessScope.assertStaff(user, staffId);
    return this.credit(staffId, amountValue, reference, description);
  }

  async debitForUser(user: any, staffId: string, amountValue: number, reference?: string, description = 'Field cash received/paid by staff') {
    await this.accessScope.assertStaff(user, staffId);
    return this.debit(staffId, amountValue, reference, description);
  }

  async credit(staffId: string, amountValue: number, reference?: string, description = 'Field cash issued to staff', db: any = this.prisma) {
    // Calls from the controller must use one DB transaction for the row lock,
    // balance update, and ledger insert. Internal callers may pass their own tx.
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.credit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    const finalReference = String(reference ?? '').trim() || createFinancialReference('PWFB-STF');
    await this.ensureUniqueReference(db, finalReference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe(`SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE`, wallet.id);
    const previous = Number(locked[0]?.balance ?? wallet.balance ?? 0), next = previous + amount;
    await db.$executeRawUnsafe(`UPDATE staff_wallets SET balance=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, wallet.id, next);
    await db.$executeRawUnsafe(`INSERT INTO staff_wallet_transactions (id,wallet_id,type,amount,previous_balance,new_balance,reference,description) VALUES ($1,$2,'ISSUE',$3,$4,$5,$6,$7)`, randomUUID(), wallet.id, amount, previous, next, finalReference, description);
    return { staffId, previousBalance: previous, amount, newBalance: next, reference: finalReference };
  }

  async debit(staffId: string, amountValue: number, reference?: string, description = 'Field cash received/paid by staff', db: any = this.prisma) {
    // Keep the lock, balance mutation, and ledger insert atomic on direct calls.
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.debit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    const finalReference = String(reference ?? '').trim() || createFinancialReference('PWFB-STF');
    await this.ensureUniqueReference(db, finalReference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe(`SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE`, wallet.id);
    const previous = Number(locked[0]?.balance ?? wallet.balance ?? 0);
    if (previous < amount) throw new BadRequestException(`Insufficient staff wallet balance. Available: ₦${previous.toFixed(2)}`);
    const next = previous - amount;
    await db.$executeRawUnsafe(`UPDATE staff_wallets SET balance=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, wallet.id, next);
    await db.$executeRawUnsafe(`INSERT INTO staff_wallet_transactions (id,wallet_id,type,amount,previous_balance,new_balance,reference,description) VALUES ($1,$2,'SETTLEMENT',$3,$4,$5,$6,$7)`, randomUUID(), wallet.id, amount, previous, next, finalReference, description);
    return { staffId, previousBalance: previous, amount, newBalance: next, reference: finalReference };
  }

  async history(staffId: string, user: any) {
    await this.accessScope.assertStaff(user, staffId);
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    return this.prisma.$queryRawUnsafe(`SELECT id, type, amount, previous_balance AS "previousBalance", new_balance AS "newBalance", reference, description, created_at AS "createdAt" FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC`, wallet.id);
  }
}
