import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { addMoney, compareMoney, moneyToNumber, subtractMoney, toMoney } from '../common/financial/money';

@Injectable()
export class StaffWalletService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  async ensureTables(db: any = this.prisma) {
    const createSql = \`CREATE TABLE IF NOT EXISTS staff_wallets (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES "Branch"(id),
      balance NUMERIC(20,2) NOT NULL DEFAULT 0.00,
      currency TEXT NOT NULL DEFAULT 'NGN',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS staff_wallet_transactions (
      id TEXT PRIMARY KEY,
      wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount NUMERIC(20,2) NOT NULL,
      previous_balance NUMERIC(20,2) NOT NULL,
      new_balance NUMERIC(20,2) NOT NULL,
      reference TEXT,
      description TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx
      ON staff_wallet_transactions(wallet_id, created_at DESC);\`;

    if (db !== this.prisma) {
      await db.$executeRawUnsafe(createSql);
      return;
    }
    if (!this.ready) {
      this.ready = this.prisma.$executeRawUnsafe(createSql).then(() => undefined).catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
  }

  private async ensureUniqueReference(db: any, reference?: string) {
    const normalized = String(reference ?? '').trim();
    if (!normalized) return;
    await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', normalized);
    const existing: any[] = await db.$queryRawUnsafe(
      'SELECT id FROM staff_wallet_transactions WHERE reference=$1 LIMIT 1',
      normalized,
    );
    if (existing.length) throw new BadRequestException('Staff wallet transaction reference already exists');
  }

  private amount(value: unknown) {
    let amount;
    try {
      amount = toMoney(String(value ?? ''));
    } catch {
      throw new BadRequestException('Wallet amount must be a valid monetary value');
    }
    if (compareMoney(amount, 0) <= 0) {
      throw new BadRequestException('Wallet amount must be at least ₦0.01');
    }
    moneyToNumber(amount);
    return amount;
  }

  private normalizeWallet<T extends { balance: any }>(wallet: T) {
    return { ...wallet, balance: moneyToNumber(toMoney(wallet.balance)) };
  }

  private normalizeTransaction<T extends { amount: any; previousBalance: any; newBalance: any }>(transaction: T) {
    return {
      ...transaction,
      amount: moneyToNumber(toMoney(transaction.amount)),
      previousBalance: moneyToNumber(toMoney(transaction.previousBalance)),
      newBalance: moneyToNumber(toMoney(transaction.newBalance)),
    };
  }

  private async staff(staffId: string, db: any = this.prisma) {
    const rows: any[] = await db.$queryRawUnsafe(
      'SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance FROM staff_wallets WHERE staff_id=$1',
      staffId,
    );
    if (rows[0]) return rows[0];

    const staffRows: any[] = await db.$queryRawUnsafe(
      'SELECT id, "staffId", "branchId", "firstName", "lastName", "position", "employmentStatus" FROM "Staff" WHERE id=$1',
      staffId,
    );
    if (!staffRows[0]) throw new NotFoundException('Staff member not found');
    if (staffRows[0].employmentStatus !== 'ACTIVE') throw new BadRequestException('Only active staff can hold a field wallet');

    const id = randomUUID();
    await db.$executeRawUnsafe(
      'INSERT INTO staff_wallets (id, staff_id, branch_id) VALUES ($1,$2,$3) ON CONFLICT (staff_id) DO NOTHING',
      id, staffId, staffRows[0].branchId,
    );
    const created: any[] = await db.$queryRawUnsafe(
      'SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance FROM staff_wallets WHERE staff_id=$1',
      staffId,
    );
    if (!created[0]) throw new NotFoundException('Staff wallet could not be created');
    return created[0];
  }

  async list(branchId?: string) {
    await this.ensureTables();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      \`SELECT w.id, w.staff_id AS "staffId", w.branch_id AS "branchId",
        w.balance, w.currency, s."firstName", s."middleName", s."lastName",
        s."position", s."employmentStatus", b.name AS "branchName"
       FROM staff_wallets w JOIN "Staff" s ON s.id=w.staff_id
       JOIN "Branch" b ON b.id=w.branch_id
       \${branchId ? 'WHERE w.branch_id=$1' : ''}
       ORDER BY s."firstName", s."lastName"\`,
      ...(branchId ? [branchId] : []),
    );
    return rows.map((row) => this.normalizeWallet(row));
  }

  async get(staffId: string) {
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    const transactions: any[] = await this.prisma.$queryRawUnsafe(
      \`SELECT id, type, amount, previous_balance AS "previousBalance",
        new_balance AS "newBalance", reference, description, created_at AS "createdAt"
       FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 100\`,
      wallet.id,
    );
    return { ...this.normalizeWallet(wallet), transactions: transactions.map((row) => this.normalizeTransaction(row)) };
  }

  async credit(staffId: string, amountValue: number, reference?: string, description = 'Field cash issued to staff', db: any = this.prisma) {
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.credit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    await this.ensureUniqueReference(db, reference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe(
      'SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE',
      wallet.id,
    );
    if (!locked[0]) throw new NotFoundException('Staff wallet could not be locked');
    const previous = toMoney(locked[0].balance ?? wallet.balance ?? 0);
    const next = addMoney(previous, amount);
    await db.$executeRawUnsafe(
      'UPDATE staff_wallets SET balance=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      wallet.id, next,
    );
    await db.$executeRawUnsafe(
      \`INSERT INTO staff_wallet_transactions
       (id,wallet_id,type,amount,previous_balance,new_balance,reference,description)
       VALUES ($1,$2,'ISSUE',$3,$4,$5,$6,$7)\`,
      randomUUID(), wallet.id, amount, previous, next, reference ?? null, description,
    );
    return { staffId, previousBalance: moneyToNumber(previous), amount: moneyToNumber(amount), newBalance: moneyToNumber(next) };
  }

  async debit(staffId: string, amountValue: number, reference?: string, description = 'Field cash received/paid by staff', db: any = this.prisma) {
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.debit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    await this.ensureUniqueReference(db, reference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe(
      'SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE',
      wallet.id,
    );
    if (!locked[0]) throw new NotFoundException('Staff wallet could not be locked');
    const previous = toMoney(locked[0].balance ?? wallet.balance ?? 0);
    if (compareMoney(previous, amount) < 0) {
      throw new BadRequestException(\`Insufficient staff wallet balance. Available: ₦\${moneyToNumber(previous).toFixed(2)}\`);
    }
    const next = subtractMoney(previous, amount);
    await db.$executeRawUnsafe(
      'UPDATE staff_wallets SET balance=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      wallet.id, next,
    );
    await db.$executeRawUnsafe(
      \`INSERT INTO staff_wallet_transactions
       (id,wallet_id,type,amount,previous_balance,new_balance,reference,description)
       VALUES ($1,$2,'SETTLEMENT',$3,$4,$5,$6,$7)\`,
      randomUUID(), wallet.id, amount, previous, next, reference ?? null, description,
    );
    return { staffId, previousBalance: moneyToNumber(previous), amount: moneyToNumber(amount), newBalance: moneyToNumber(next) };
  }

  async history(staffId: string) {
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    const transactions: any[] = await this.prisma.$queryRawUnsafe(
      \`SELECT id, type, amount, previous_balance AS "previousBalance",
        new_balance AS "newBalance", reference, description, created_at AS "createdAt"
       FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC\`,
      wallet.id,
    );
    return transactions.map((row) => this.normalizeTransaction(row));
  }
}
