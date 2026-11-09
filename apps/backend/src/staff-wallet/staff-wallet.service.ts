import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalBankTransferService } from '../banking/external-bank-transfer.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class StaffWalletService {
  private ready: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly externalBankTransfer: ExternalBankTransferService,
    private readonly permissions: PermissionsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async ensureTables(db: any = this.prisma) {
    if (db !== this.prisma) {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS staff_wallets (
          id TEXT PRIMARY KEY,
          staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES "Branch"(id),
          balance DOUBLE PRECISION NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'NGN',
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS staff_wallet_transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          previous_balance DOUBLE PRECISION NOT NULL,
          new_balance DOUBLE PRECISION NOT NULL,
          reference TEXT,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'COMPLETED',
          provider TEXT,
          provider_reference TEXT,
          failure_reason TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED';
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS provider TEXT;
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS provider_reference TEXT;
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx ON staff_wallet_transactions(wallet_id, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS staff_wallet_tx_provider_reference_key ON staff_wallet_transactions(provider_reference) WHERE provider_reference IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS staff_wallet_tx_reference_key ON staff_wallet_transactions(reference) WHERE reference IS NOT NULL;
        CREATE TABLE IF NOT EXISTS staff_wallet_withdrawal_requests (
          id TEXT PRIMARY KEY,
          staff_id TEXT NOT NULL REFERENCES "Staff"(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES "Branch"(id),
          requested_by_user_id TEXT NOT NULL,
          requested_by_email TEXT,
          amount DOUBLE PRECISION NOT NULL,
          currency TEXT NOT NULL DEFAULT 'NGN',
          bank_code TEXT NOT NULL,
          account_number TEXT NOT NULL,
          account_name TEXT NOT NULL,
          provider TEXT,
          name_match_count INTEGER NOT NULL,
          reference TEXT NOT NULL UNIQUE,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
          approved_by_user_id TEXT,
          approved_by_email TEXT,
          approved_at TIMESTAMP(3),
          provider_reference TEXT,
          failure_reason TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS staff_wallet_request_staff_created_idx ON staff_wallet_withdrawal_requests(staff_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS staff_wallet_request_branch_status_idx ON staff_wallet_withdrawal_requests(branch_id, status, created_at DESC);
      `);
      return;
    }

    if (!this.ready) {
      this.ready = this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS staff_wallets (
          id TEXT PRIMARY KEY,
          staff_id TEXT NOT NULL UNIQUE REFERENCES "Staff"(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES "Branch"(id),
          balance DOUBLE PRECISION NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'NGN',
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS staff_wallet_transactions (
          id TEXT PRIMARY KEY,
          wallet_id TEXT NOT NULL REFERENCES staff_wallets(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          amount DOUBLE PRECISION NOT NULL,
          previous_balance DOUBLE PRECISION NOT NULL,
          new_balance DOUBLE PRECISION NOT NULL,
          reference TEXT,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'COMPLETED',
          provider TEXT,
          provider_reference TEXT,
          failure_reason TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'COMPLETED';
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS provider TEXT;
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS provider_reference TEXT;
        ALTER TABLE staff_wallet_transactions ADD COLUMN IF NOT EXISTS failure_reason TEXT;
        CREATE INDEX IF NOT EXISTS staff_wallet_tx_wallet_created_idx ON staff_wallet_transactions(wallet_id, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS staff_wallet_tx_provider_reference_key ON staff_wallet_transactions(provider_reference) WHERE provider_reference IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS staff_wallet_tx_reference_key ON staff_wallet_transactions(reference) WHERE reference IS NOT NULL;
        CREATE TABLE IF NOT EXISTS staff_wallet_withdrawal_requests (
          id TEXT PRIMARY KEY,
          staff_id TEXT NOT NULL REFERENCES "Staff"(id) ON DELETE CASCADE,
          branch_id TEXT NOT NULL REFERENCES "Branch"(id),
          requested_by_user_id TEXT NOT NULL,
          requested_by_email TEXT,
          amount DOUBLE PRECISION NOT NULL,
          currency TEXT NOT NULL DEFAULT 'NGN',
          bank_code TEXT NOT NULL,
          account_number TEXT NOT NULL,
          account_name TEXT NOT NULL,
          provider TEXT,
          name_match_count INTEGER NOT NULL,
          reference TEXT NOT NULL UNIQUE,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
          approved_by_user_id TEXT,
          approved_by_email TEXT,
          approved_at TIMESTAMP(3),
          provider_reference TEXT,
          failure_reason TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS staff_wallet_request_staff_created_idx ON staff_wallet_withdrawal_requests(staff_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS staff_wallet_request_branch_status_idx ON staff_wallet_withdrawal_requests(branch_id, status, created_at DESC);
      `).then(() => undefined).catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
  }

  private async ensureUniqueReference(db: any, reference?: string) {
    const normalized = String(reference ?? '').trim();
    if (!normalized) return;
    await db.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', normalized);
    const existing: any[] = await db.$queryRawUnsafe(
      'SELECT id FROM staff_wallet_transactions WHERE reference=$1 LIMIT 1',
      normalized,
    );
    if (existing.length) throw new BadRequestException('Staff wallet transaction reference already exists');
  }

  private amount(value: unknown) {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number) || number <= 0) {
      throw new BadRequestException('Wallet amount must be greater than zero');
    }
    const rounded = Math.round((number + Number.EPSILON) * 100) / 100;
    if (rounded <= 0) throw new BadRequestException('Wallet amount must be at least ₦0.01');
    return rounded;
  }

  private async staff(staffId: string, db: any = this.prisma) {
    const rows: any[] = await db.$queryRawUnsafe(
      'SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance, currency FROM staff_wallets WHERE staff_id=$1 LIMIT 1',
      staffId,
    );
    if (rows[0]) return rows[0];
    const staffRows: any[] = await db.$queryRawUnsafe(
      `SELECT id, "staffId", "branchId", "firstName", "lastName", "position", "employmentStatus"
       FROM "Staff" WHERE id=$1 LIMIT 1`,
      staffId,
    );
    if (!staffRows[0]) throw new NotFoundException('Staff member not found');
    if (staffRows[0].employmentStatus !== 'ACTIVE') {
      throw new BadRequestException('Only active staff can hold a field wallet');
    }
    const id = randomUUID();
    await db.$executeRawUnsafe(
      'INSERT INTO staff_wallets (id, staff_id, branch_id) VALUES ($1,$2,$3) ON CONFLICT (staff_id) DO NOTHING',
      id, staffId, staffRows[0].branchId,
    );
    const created: any[] = await db.$queryRawUnsafe(
      'SELECT id, staff_id AS "staffId", branch_id AS "branchId", balance, currency FROM staff_wallets WHERE staff_id=$1 LIMIT 1',
      staffId,
    );
    if (!created[0]) throw new BadRequestException('Staff wallet could not be initialized');
    return created[0];
  }

  private async resolveOwnStaff(user: any) {
    const userId = String(user?.id || user?.sub || '').trim();
    const claimedStaffId = String(user?.staffId || '').trim();
    if (!userId && !claimedStaffId) throw new UnauthorizedException('Authenticated staff login is required');
    let staff = userId
      ? await this.prisma.staff.findUnique({
          where: { userId },
          select: {
            id: true, staffId: true, userId: true, firstName: true, middleName: true,
            lastName: true, branchId: true, employmentStatus: true,
          },
        })
      : null;
    if (!staff && claimedStaffId) {
      staff = await this.prisma.staff.findUnique({
        where: { id: claimedStaffId },
        select: {
          id: true, staffId: true, userId: true, firstName: true, middleName: true,
          lastName: true, branchId: true, employmentStatus: true,
        },
      });
    }
    if (!staff) throw new ForbiddenException('Your login is not linked to an individual staff account');
    if (claimedStaffId && staff.id !== claimedStaffId) {
      throw new ForbiddenException('Staff identity links do not match. Contact LAB Microfinance Super Admin.');
    }
    if (staff.userId && userId && staff.userId !== userId) {
      throw new ForbiddenException('This staff wallet belongs to another login');
    }
    if (staff.employmentStatus !== 'ACTIVE') {
      throw new ForbiddenException('Only active staff members can transact through a staff wallet');
    }
    return staff;
  }

  async list(branchId?: string) {
    await this.ensureTables();
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT w.id, w.staff_id AS "staffId", w.branch_id AS "branchId", w.balance, w.currency,
       s."firstName", s."middleName", s."lastName", s."position", s."employmentStatus",
       b.name AS "branchName", a."accountNumber", a."accountName", a."bankName", a.status AS "virtualAccountStatus"
       FROM staff_wallets w
       JOIN "Staff" s ON s.id=w.staff_id
       JOIN "Branch" b ON b.id=w.branch_id
       LEFT JOIN "StaffVirtualAccount" a ON a."staffId"=w.staff_id
       ${branchId ? 'WHERE w.branch_id=$1' : ''}
       ORDER BY s."firstName", s."lastName"`,
      ...(branchId ? [branchId] : []),
    );
    return rows;
  }

  async get(staffId: string) {
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    const transactions: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, type, amount, previous_balance AS "previousBalance",
       new_balance AS "newBalance", reference, description, status, provider,
       provider_reference AS "providerReference", failure_reason AS "failureReason",
       created_at AS "createdAt"
       FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 200`,
      wallet.id,
    );
    return { ...wallet, transactions };
  }

  async getMe(user: any) {
    await this.ensureTables();
    const staff = await this.resolveOwnStaff(user);
    const wallet = await this.get(staff.id);
    const virtualAccount = await this.prisma.staffVirtualAccount.findUnique({
      where: { staffId: staff.id },
      include: { institution: { select: { id: true, name: true, shortName: true } } },
    });
    const requests = await this.listMyWithdrawalRequests(staff.id);
    return {
      staff: {
        id: staff.id,
        staffId: staff.staffId,
        firstName: staff.firstName,
        middleName: staff.middleName,
        lastName: staff.lastName,
        branchId: staff.branchId,
      },
      wallet,
      account: virtualAccount ? {
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        bankName: virtualAccount.bankName || virtualAccount.institution?.name || null,
        provider: virtualAccount.provider,
        status: virtualAccount.status,
        assignedAt: virtualAccount.assignedAt,
        failureReason: virtualAccount.failureReason,
      } : null,
      withdrawalRequests: requests,
      permissions: {
        deposit: await this.permissions.get(String(user?.role || ''), 'WALLET_DEPOSIT'),
        withdrawal: await this.permissions.get(String(user?.role || ''), 'WALLET_WITHDRAWAL'),
        transfer: await this.permissions.get(String(user?.role || ''), 'BANK_TRANSFER'),
      },
    };
  }

  async listMyWithdrawalRequests(staffId: string) {
    await this.ensureTables();
    return this.prisma.$queryRawUnsafe(
      `SELECT id, amount, currency, bank_code AS "bankCode",
       RIGHT(account_number, 4) AS "accountLastFour", account_name AS "accountName",
       name_match_count AS "nameMatchCount", reference, description, status,
       approved_by_email AS "approvedBy", approved_at AS "approvedAt",
       provider_reference AS "providerReference", failure_reason AS "failureReason",
       created_at AS "createdAt", updated_at AS "updatedAt"
       FROM staff_wallet_withdrawal_requests WHERE staff_id=$1 ORDER BY created_at DESC LIMIT 100`,
      staffId,
    );
  }

  async myWithdrawalRequests(user: any) {
    const staff = await this.resolveOwnStaff(user);
    return this.listMyWithdrawalRequests(staff.id);
  }

  async requestWithdrawal(input: {
    amount: number;
    bankCode: string;
    accountNumber: string;
    accountName?: string;
    provider?: string;
    description?: string;
    reference?: string;
  }, user: any) {
    await this.permissions.assert(String(user?.role || ''), 'WALLET_WITHDRAWAL');
    await this.permissions.assert(String(user?.role || ''), 'BANK_TRANSFER');
    await this.ensureTables();
    const staff = await this.resolveOwnStaff(user);
    const amount = this.amount(input?.amount);
    const bankCode = String(input?.bankCode || '').trim();
    const accountNumber = String(input?.accountNumber || '').replace(/\D/g, '');
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      throw new BadRequestException('Select a bank and enter the complete 10-digit payout account number');
    }
    const verified = await this.externalBankTransfer.verifyStaffBankAccount(
      staff.id, bankCode, accountNumber, input?.provider,
    );
    const verifiedAccountName = String(verified.accountName || '').trim();
    if (!verifiedAccountName || Number(verified.nameMatchCount || 0) < 2) {
      throw new BadRequestException('LAB Microfinance requires at least two names to match the verified staff bank account');
    }
    const providedName = String(input?.accountName || '').trim();
    if (providedName && this.normalizeName(providedName) !== this.normalizeName(verifiedAccountName)) {
      throw new BadRequestException('The bank account name changed after verification. Please verify it again.');
    }
    const wallet = await this.staff(staff.id);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient staff wallet balance for this withdrawal request');
    }
    const reference = String(input?.reference || `STAFF-WDR-${randomUUID()}`).trim();
    if (reference.length < 5 || reference.length > 120) {
      throw new BadRequestException('Enter a valid unique withdrawal reference');
    }
    const existing = await this.prisma.$queryRawUnsafe(
      'SELECT id FROM staff_wallet_withdrawal_requests WHERE reference=$1 LIMIT 1',
      reference,
    );
    if (existing.length) throw new BadRequestException('Staff withdrawal request reference already exists');

    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO staff_wallet_withdrawal_requests
       (id,staff_id,branch_id,requested_by_user_id,requested_by_email,amount,currency,
        bank_code,account_number,account_name,provider,name_match_count,reference,description,status)
       VALUES ($1,$2,$3,$4,$5,$6,'NGN',$7,$8,$9,$10,$11,$12,$13,'PENDING_APPROVAL')`,
      id, staff.id, staff.branchId, String(user?.id || user?.sub || ''),
      user?.email || null, amount, bankCode, accountNumber, verifiedAccountName,
      String(verified.provider || input?.provider || '').toUpperCase() || null,
      Number(verified.nameMatchCount), reference, String(input?.description || 'Staff wallet withdrawal').trim(),
    );
    return {
      id,
      staffId: staff.id,
      amount,
      currency: 'NGN',
      bankCode,
      accountLastFour: accountNumber.slice(-4),
      accountName: verifiedAccountName,
      nameMatchCount: Number(verified.nameMatchCount),
      reference,
      status: 'PENDING_APPROVAL',
      message: 'Request sent to LAB Microfinance for approval. Your wallet has not been debited.',
    };
  }

  private normalizeName(value: string) {
    return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
  }

  async listPendingWithdrawalRequests(actor: any) {
    const role = String(actor?.role || '').toUpperCase();
    if (!['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(role)) {
      throw new ForbiddenException('Only LAB Microfinance approvers may view pending staff withdrawals');
    }
    await this.ensureTables();
    const scope = await this.accessScope.getScope(actor);
    let rows: any[] = [];
    if (scope.global) {
      rows = await this.prisma.$queryRawUnsafe(
        `SELECT r.id,r.staff_id AS "staffId",r.branch_id AS "branchId",
         r.amount,r.currency,r.bank_code AS "bankCode",
         RIGHT(r.account_number,4) AS "accountLastFour",r.account_name AS "accountName",
         r.name_match_count AS "nameMatchCount",r.reference,r.description,r.status,
         r.requested_by_email AS "requestedBy",r.created_at AS "createdAt",
         s."firstName",s."middleName",s."lastName",b.name AS "branchName"
         FROM staff_wallet_withdrawal_requests r
         JOIN "Staff" s ON s.id=r.staff_id
         JOIN "Branch" b ON b.id=r.branch_id
         WHERE r.status='PENDING_APPROVAL' ORDER BY r.created_at ASC LIMIT 300`,
      );
    } else {
      const branchIds = await this.accessScope.getScopedBranchIds(actor);
      if (!branchIds?.length) return [];
      rows = await this.prisma.$queryRawUnsafe(
        `SELECT r.id,r.staff_id AS "staffId",r.branch_id AS "branchId",
         r.amount,r.currency,r.bank_code AS "bankCode",
         RIGHT(r.account_number,4) AS "accountLastFour",r.account_name AS "accountName",
         r.name_match_count AS "nameMatchCount",r.reference,r.description,r.status,
         r.requested_by_email AS "requestedBy",r.created_at AS "createdAt",
         s."firstName",s."middleName",s."lastName",b.name AS "branchName"
         FROM staff_wallet_withdrawal_requests r
         JOIN "Staff" s ON s.id=r.staff_id
         JOIN "Branch" b ON b.id=r.branch_id
         WHERE r.status='PENDING_APPROVAL' AND r.branch_id=ANY($1::text[])
         ORDER BY r.created_at ASC LIMIT 300`,
        branchIds,
      );
    }
    return rows;
  }

  async approveWithdrawal(requestId: string, actor: any) {
    const actorUserId = String(actor?.id || actor?.sub || '').trim();
    if (!actorUserId) throw new UnauthorizedException('Authenticated LAB approver is required');
    const role = String(actor?.role || '').toUpperCase();
    if (!['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(role)) {
      throw new ForbiddenException('Only LAB Microfinance Super Admin, Admin or Branch Manager may approve staff wallet withdrawals');
    }
    await this.ensureTables();
    const requestRows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM staff_wallet_withdrawal_requests WHERE id=$1 LIMIT 1',
      requestId,
    );
    const initial = requestRows[0];
    if (!initial) throw new NotFoundException('Staff wallet withdrawal request not found');
    if (String(initial.requested_by_user_id) === actorUserId) {
      throw new ForbiddenException('The requester cannot approve their own staff wallet withdrawal');
    }
    if (role !== 'SUPER_ADMIN') {
      await this.accessScope.assertBranch(actor, String(initial.branch_id));
    }
    // Revalidate the staff name/account at approval time; the beneficiary may not
    // be changed after a request is submitted.
    const verified = await this.externalBankTransfer.verifyStaffBankAccount(
      String(initial.staff_id),
      String(initial.bank_code),
      String(initial.account_number),
      String(initial.provider || ''),
    );
    const verifiedAccountName = String(verified.accountName || '').trim();
    if (Number(verified.nameMatchCount || 0) < 2
      || this.normalizeName(verifiedAccountName) !== this.normalizeName(String(initial.account_name || ''))) {
      throw new BadRequestException('The saved staff bank account no longer passes LAB two-name verification. Request was not approved.');
    }

    const reference = `PWFB-STAFF-WITHDRAW-${requestId}`;
    const reservation = await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM staff_wallet_withdrawal_requests WHERE id=$1 FOR UPDATE',
        requestId,
      );
      const lockedRows = await tx.$queryRawUnsafe(
        'SELECT * FROM staff_wallet_withdrawal_requests WHERE id=$1 LIMIT 1',
        requestId,
      );
      const request = lockedRows[0];
      if (!request) throw new NotFoundException('Staff wallet withdrawal request not found');
      if (request.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(`Withdrawal request is ${request.status}; it cannot be approved again`);
      }
      if (String(request.requested_by_user_id) === actorUserId) {
        throw new ForbiddenException('The requester cannot approve their own staff wallet withdrawal');
      }
      const wallet = await this.staff(String(request.staff_id), tx);
      const lockedWalletRows = await tx.$queryRawUnsafe(
        'SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE',
        wallet.id,
      );
      const previousBalance = Number(lockedWalletRows[0]?.balance ?? wallet.balance ?? 0);
      const amount = Number(request.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Invalid withdrawal request amount');
      if (previousBalance < amount) throw new BadRequestException('Insufficient staff wallet balance at approval time');
      const nextBalance = Math.round((previousBalance - amount) * 100) / 100;
      await tx.$executeRawUnsafe(
        'UPDATE staff_wallets SET balance=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$1',
        wallet.id, nextBalance,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO staff_wallet_transactions
         (id,wallet_id,type,amount,previous_balance,new_balance,reference,description,status,provider,provider_reference)
         VALUES ($1,$2,'WITHDRAWAL',$3,$4,$5,$6,$7,'PROCESSING',$8,$6)`,
        randomUUID(), wallet.id, amount, previousBalance, nextBalance,
        reference, String(request.description || 'Staff wallet withdrawal'),
        String(verified.provider || request.provider || '').toUpperCase() || null,
      );
      await tx.$executeRawUnsafe(
        `UPDATE staff_wallet_withdrawal_requests
         SET status='PROCESSING',approved_by_user_id=$2,approved_by_email=$3,
             approved_at=CURRENT_TIMESTAMP,provider_reference=$4,updated_at=CURRENT_TIMESTAMP
         WHERE id=$1`,
        requestId, actorUserId, actor?.email || null, reference,
      );
      return {
        amount,
        bankCode: String(request.bank_code),
        accountNumber: String(request.account_number),
        accountName: verifiedAccountName,
        provider: String(verified.provider || request.provider || '').toUpperCase(),
        reference,
        staffId: String(request.staff_id),
      };
    });

    let providerResult: any;
    try {
      providerResult = await this.externalBankTransfer.transferToVerifiedAccount({
        bankCode: reservation.bankCode,
        accountNumber: reservation.accountNumber,
        accountName: reservation.accountName,
        amount: reservation.amount,
        narration: String(initial.description || 'LAB Microfinance staff wallet withdrawal'),
        reference: reservation.reference,
        provider: reservation.provider,
      });
    } catch {
      // The provider may have accepted a transfer before timing out. Keep the
      // amount reserved and reconcile using the provider webhook/reference.
      throw new ServiceUnavailableException(
        `Staff withdrawal status is uncertain. Funds remain reserved for reconciliation. Reference: ${reservation.reference}`,
      );
    }

    const providerStatus = String(providerResult?.status || '').toUpperCase();
    if (['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(providerStatus)) {
      await this.refundFailedWithdrawal(requestId, reservation.reference, 'Provider rejected the staff wallet transfer');
      return { id: requestId, status: 'FAILED', refunded: true, provider: providerResult };
    }
    if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(providerStatus)) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE staff_wallet_transactions SET status='COMPLETED',provider_reference=$2
         WHERE reference=$1 AND status='PROCESSING'`,
        reservation.reference,
        String(providerResult?.providerReference || providerResult?.transactionReference || reservation.reference),
      );
      await this.prisma.$executeRawUnsafe(
        `UPDATE staff_wallet_withdrawal_requests SET status='COMPLETED',provider_reference=$2,
         updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PROCESSING'`,
        requestId,
        String(providerResult?.providerReference || providerResult?.transactionReference || reservation.reference),
      );
      return { id: requestId, status: 'COMPLETED', provider: providerResult };
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE staff_wallet_transactions SET provider_reference=$2 WHERE reference=$1 AND status='PROCESSING'`,
      reservation.reference,
      String(providerResult?.providerReference || providerResult?.transactionReference || reservation.reference),
    );
    await this.prisma.$executeRawUnsafe(
      `UPDATE staff_wallet_withdrawal_requests SET provider_reference=$2,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status='PROCESSING'`,
      requestId,
      String(providerResult?.providerReference || providerResult?.transactionReference || reservation.reference),
    );
    return { id: requestId, status: 'PROCESSING', provider: providerResult };
  }

  async rejectWithdrawal(requestId: string, reasonValue: unknown, actor: any) {
    const actorUserId = String(actor?.id || actor?.sub || '').trim();
    const role = String(actor?.role || '').toUpperCase();
    if (!actorUserId || !['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(role)) {
      throw new ForbiddenException('Only LAB Microfinance Super Admin, Admin or Branch Manager may reject staff wallet withdrawals');
    }
    await this.ensureTables();
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM staff_wallet_withdrawal_requests WHERE id=$1 LIMIT 1',
      requestId,
    );
    const request = rows[0];
    if (!request) throw new NotFoundException('Staff wallet withdrawal request not found');
    if (String(request.requested_by_user_id) === actorUserId) {
      throw new ForbiddenException('The requester cannot reject their own staff wallet withdrawal');
    }
    if (role !== 'SUPER_ADMIN') await this.accessScope.assertBranch(actor, String(request.branch_id));
    const reason = String(reasonValue || '').trim();
    if (reason.length < 5) throw new BadRequestException('A clear rejection reason is required');
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE staff_wallet_withdrawal_requests SET status='REJECTED',approved_by_user_id=$2,
       approved_by_email=$3,failure_reason=$4,updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status='PENDING_APPROVAL'`,
      requestId, actorUserId, actor?.email || null, reason,
    );
    if (Number(result) !== 1) throw new BadRequestException('Withdrawal request changed before rejection; refresh and try again');
    return { id: requestId, status: 'REJECTED', reason };
  }

  private async refundFailedWithdrawal(requestId: string, reference: string, reason: string) {
    await this.prisma.$transaction(async (tx: any) => {
      const rows = await tx.$queryRawUnsafe(
        'SELECT wallet_id,amount,status FROM staff_wallet_transactions WHERE reference=$1 FOR UPDATE',
        reference,
      );
      const transaction = rows[0];
      if (!transaction || transaction.status !== 'PROCESSING') return;
      const walletRows = await tx.$queryRawUnsafe(
        'SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE',
        transaction.wallet_id,
      );
      const previous = Number(walletRows[0]?.balance || 0);
      const amount = Number(transaction.amount);
      const restored = Math.round((previous + amount) * 100) / 100;
      await tx.$executeRawUnsafe(
        'UPDATE staff_wallets SET balance=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',
        transaction.wallet_id, restored,
      );
      await tx.$executeRawUnsafe(
        `UPDATE staff_wallet_transactions SET status='FAILED',new_balance=$2,failure_reason=$3
         WHERE reference=$1 AND status='PROCESSING'`,
        reference, restored, reason,
      );
      await tx.$executeRawUnsafe(
        `UPDATE staff_wallet_withdrawal_requests SET status='FAILED',failure_reason=$2,
         updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='PROCESSING'`,
        requestId, reason,
      );
    });
  }

  async reconcileWithdrawal(input: {
    reference: string;
    status: 'COMPLETED' | 'FAILED';
    provider?: string;
    providerReference?: string;
    failureReason?: string;
  }) {
    await this.ensureTables();
    const reference = String(input.reference || '').trim();
    if (!reference) throw new BadRequestException('Staff wallet withdrawal reference is required');
    if (input.status === 'FAILED') {
      await this.refundFailedWithdrawal(
        String((await this.prisma.$queryRawUnsafe(
          'SELECT id FROM staff_wallet_withdrawal_requests WHERE provider_reference=$1 OR reference=$1 LIMIT 1',
          reference,
        ))[0]?.id || ''),
        reference,
        input.failureReason || 'Provider reported failed staff withdrawal',
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        `UPDATE staff_wallet_transactions SET status='COMPLETED',provider=$2,
         provider_reference=COALESCE($3,provider_reference) WHERE reference=$1 AND status='PROCESSING'`,
        reference, input.provider || null, input.providerReference || null,
      );
      await this.prisma.$executeRawUnsafe(
        `UPDATE staff_wallet_withdrawal_requests SET status='COMPLETED',provider_reference=COALESCE($2,provider_reference),
         updated_at=CURRENT_TIMESTAMP WHERE provider_reference=$1 OR reference=$1`,
        reference, input.providerReference || null,
      );
    }
    return { ok: true, reconciled: true, reference, status: input.status };
  }

  async history(staffId: string) {
    await this.ensureTables();
    const wallet = await this.staff(staffId);
    return this.prisma.$queryRawUnsafe(
      `SELECT id,type,amount,previous_balance AS "previousBalance",
       new_balance AS "newBalance",reference,description,status,provider,
       provider_reference AS "providerReference",failure_reason AS "failureReason",
       created_at AS "createdAt"
       FROM staff_wallet_transactions WHERE wallet_id=$1 ORDER BY created_at DESC`,
      wallet.id,
    );
  }

  async credit(
    staffId: string,
    amountValue: number,
    reference?: string,
    description = 'Field cash issued to staff',
    db: any = this.prisma,
  ) {
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.credit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    await this.ensureUniqueReference(db, reference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe('SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE', wallet.id);
    const previous = Number(locked[0]?.balance ?? wallet.balance ?? 0);
    const next = previous + amount;
    await db.$executeRawUnsafe(
      'UPDATE staff_wallets SET balance=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      wallet.id, next,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO staff_wallet_transactions (id,wallet_id,type,amount,previous_balance,new_balance,reference,description,status)
       VALUES ($1,$2,'ISSUE',$3,$4,$5,$6,$7,'COMPLETED')`,
      randomUUID(), wallet.id, amount, previous, next, reference ?? null, description,
    );
    return { staffId, previousBalance: previous, amount, newBalance: next };
  }

  async debit(
    staffId: string,
    amountValue: number,
    reference?: string,
    description = 'Field cash received/paid by staff',
    db: any = this.prisma,
  ) {
    if (db === this.prisma) {
      return this.prisma.$transaction((tx: any) => this.debit(staffId, amountValue, reference, description, tx));
    }
    await this.ensureTables(db);
    const amount = this.amount(amountValue);
    await this.ensureUniqueReference(db, reference);
    const wallet = await this.staff(staffId, db);
    const locked: any[] = await db.$queryRawUnsafe('SELECT balance FROM staff_wallets WHERE id=$1 FOR UPDATE', wallet.id);
    const previous = Number(locked[0]?.balance ?? wallet.balance ?? 0);
    if (previous < amount) throw new BadRequestException(`Insufficient staff wallet balance. Available: ₦${previous.toFixed(2)}`);
    const next = previous - amount;
    await db.$executeRawUnsafe(
      'UPDATE staff_wallets SET balance=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1',
      wallet.id, next,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO staff_wallet_transactions (id,wallet_id,type,amount,previous_balance,new_balance,reference,description,status)
       VALUES ($1,$2,'SETTLEMENT',$3,$4,$5,$6,$7,'COMPLETED')`,
      randomUUID(), wallet.id, amount, previous, next, reference ?? null, description,
    );
    return { staffId, previousBalance: previous, amount, newBalance: next };
  }
}
