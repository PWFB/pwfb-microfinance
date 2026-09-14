import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [users, customers, staff, activeStaff, branches, departments, savings, loans, repayments, transactions] = await Promise.all([
      this.prisma.user.count(), this.prisma.customer.count(), this.prisma.staff.count(),
      this.prisma.staff.count({ where: { employmentStatus: 'ACTIVE' } }),
      this.prisma.branch.count(), this.prisma.department.count(),
      this.prisma.savings.aggregate({ _sum: { amount: true } }),
      this.prisma.loan.aggregate({ _sum: { amount: true } }),
      this.prisma.repayment.aggregate({ _sum: { amount: true } }),
      this.prisma.transaction.count(),
    ]);
    const totalSavings = savings._sum.amount ?? 0;
    const totalLoans = loans._sum.amount ?? 0;
    const totalRepayments = repayments._sum.amount ?? 0;
    return { system: { users, customers, staff, activeStaff, branches, departments, transactions }, finance: { totalSavings, totalLoans, totalRepayments, outstandingLoans: Math.max(totalLoans - totalRepayments, 0) } };
  }

  async systemStats() {
    const [users, customers, staff, branches, departments, transactions] = await Promise.all([
      this.prisma.user.count(), this.prisma.customer.count(), this.prisma.staff.count(), this.prisma.branch.count(), this.prisma.department.count(), this.prisma.transaction.count(),
    ]);
    return { users, customers, staff, branches, departments, transactions };
  }

  async financialStats() {
    const [savings, loans, repayments] = await Promise.all([
      this.prisma.savings.aggregate({ _sum: { amount: true } }),
      this.prisma.loan.aggregate({ _sum: { amount: true } }),
      this.prisma.repayment.aggregate({ _sum: { amount: true } }),
    ]);
    const totalSavings = savings._sum.amount ?? 0;
    const totalLoans = loans._sum.amount ?? 0;
    const totalRepayments = repayments._sum.amount ?? 0;
    return { totalSavings, totalLoans, totalRepayments, outstandingLoans: Math.max(totalLoans - totalRepayments, 0) };
  }

  async staffStats() {
    const [total, active, inactive] = await Promise.all([
      this.prisma.staff.count(),
      this.prisma.staff.count({ where: { employmentStatus: 'ACTIVE' } }),
      this.prisma.staff.count({ where: { employmentStatus: { not: 'ACTIVE' } } }),
    ]);
    return { total, active, inactive };
  }

  private async ensureAdminWalletTable() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'NGN', "balance" DOUBLE PRECISION NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "pwfb_admin_wallet_transactions" ("id" TEXT PRIMARY KEY, "walletId" TEXT NOT NULL, "type" TEXT NOT NULL, "amount" DOUBLE PRECISION NOT NULL, "previousBalance" DOUBLE PRECISION NOT NULL, "newBalance" DOUBLE PRECISION NOT NULL, "reference" TEXT NOT NULL UNIQUE, "description" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await this.prisma.$executeRawUnsafe(`INSERT INTO "pwfb_admin_wallet" ("id","name") VALUES ('SUPER_ADMIN_CHARGES','Super Admin Charges Wallet') ON CONFLICT ("id") DO NOTHING`);
  }

  async adminWallet() {
    await this.ensureAdminWalletTable();
    const rows = await this.prisma.$queryRaw<Array<{id:string;name:string;currency:string;balance:number;createdAt:Date;updatedAt:Date}>>`SELECT "id","name","currency","balance","createdAt","updatedAt" FROM "pwfb_admin_wallet" WHERE "id"='SUPER_ADMIN_CHARGES' LIMIT 1`;
    return rows[0];
  }

  async adminWalletTransactions() {
    await this.ensureAdminWalletTable();
    return this.prisma.$queryRaw<Array<{id:string;type:string;amount:number;previousBalance:number;newBalance:number;reference:string;description:string|null;createdAt:Date}>>`SELECT "id","type","amount","previousBalance","newBalance","reference","description","createdAt" FROM "pwfb_admin_wallet_transactions" WHERE "walletId"='SUPER_ADMIN_CHARGES' ORDER BY "createdAt" DESC`;
  }

  async recordAdminCharge(body: { amount: number; reference?: string; description?: string }) {
    const amount = Math.round(Number(body?.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Charge amount must be greater than zero');
    const reference = String(body?.reference || `CHG-${Date.now()}-${randomUUID().slice(0,8).toUpperCase()}`).trim();
    if (!reference) throw new BadRequestException('Charge reference is required');
    await this.ensureAdminWalletTable();
    return this.prisma.$transaction(async tx => {
      const walletRows = await tx.$queryRaw<Array<{id:string;balance:number}>>`SELECT "id","balance" FROM "pwfb_admin_wallet" WHERE "id"='SUPER_ADMIN_CHARGES' FOR UPDATE`;
      const wallet = walletRows[0];
      if (!wallet) throw new BadRequestException('Super Admin charges wallet is unavailable');
      const previousBalance = Number(wallet.balance || 0);
      const newBalance = Math.round((previousBalance + amount) * 100) / 100;
      await tx.$executeRaw`UPDATE "pwfb_admin_wallet" SET "balance"=${newBalance}, "updatedAt"=NOW() WHERE "id"='SUPER_ADMIN_CHARGES'`;
      await tx.$executeRaw`INSERT INTO "pwfb_admin_wallet_transactions" ("id","walletId","type","amount","previousBalance","newBalance","reference","description") VALUES (${randomUUID()},'SUPER_ADMIN_CHARGES','CHARGE',${amount},${previousBalance},${newBalance},${reference},${String(body?.description || 'PWFB charge')})`;
      return { balance: newBalance, amount, reference };
    });
  }
}
