import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CashbookDailyInput = {
  periodId: string;
  branchId: string;
  entryDate?: string;
  description?: string;
  dailyLoanNo?: number;
  dailyLoanAmount?: number;
  weeklyLoanNo?: number;
  weeklyLoanAmount?: number;
  monthlyLoanNo?: number;
  monthlyLoanAmount?: number;
  bankDeposit?: number;
  savingWithdrawal?: number;
  savingReturned?: number;
  savingAdjustment?: number;
  fundTransferHeadOffice?: number;
  fundTransferBranchOffice?: number;
  otherAmount?: number;
  expenseAmount?: number;
  narration?: string;
  referenceNo?: string;
};

const MONEY_FIELDS = [
  'dailyLoanAmount', 'weeklyLoanAmount', 'monthlyLoanAmount', 'bankDeposit',
  'savingWithdrawal', 'savingReturned', 'savingAdjustment',
  'fundTransferHeadOffice', 'fundTransferBranchOffice', 'otherAmount', 'expenseAmount',
] as const;

@Injectable()
export class CashbookService {
  private dailyTableReady: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureDailyTable() {
    if (!this.dailyTableReady) {
      this.dailyTableReady = this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS cashbook_daily_records (
          id TEXT PRIMARY KEY,
          period_id TEXT NOT NULL REFERENCES "FinancialPeriod"(id),
          branch_id TEXT NOT NULL REFERENCES "Branch"(id),
          entry_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          description TEXT,
          daily_loan_no INTEGER NOT NULL DEFAULT 0,
          daily_loan_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          weekly_loan_no INTEGER NOT NULL DEFAULT 0,
          weekly_loan_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          monthly_loan_no INTEGER NOT NULL DEFAULT 0,
          monthly_loan_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
          saving_withdrawal DOUBLE PRECISION NOT NULL DEFAULT 0,
          saving_returned DOUBLE PRECISION NOT NULL DEFAULT 0,
          saving_adjustment DOUBLE PRECISION NOT NULL DEFAULT 0,
          fund_transfer_head_office DOUBLE PRECISION NOT NULL DEFAULT 0,
          fund_transfer_branch_office DOUBLE PRECISION NOT NULL DEFAULT 0,
          other_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          expense_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
          narration TEXT,
          reference_no TEXT,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).then(() => undefined).catch((error) => {
        this.dailyTableReady = null;
        throw error;
      });
    }
    await this.dailyTableReady;
  }

  private money(value: unknown) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new BadRequestException('Cashbook amounts must be zero or greater');
    }
    return amount;
  }

  private int(value: unknown) {
    const amount = Number(value ?? 0);
    if (!Number.isInteger(amount) || amount < 0) {
      throw new BadRequestException('Loan counts must be whole numbers greater than or equal to zero');
    }
    return amount;
  }

  private values(data: CashbookDailyInput) {
    const v: Record<string, number> = {};
    for (const field of MONEY_FIELDS) v[field] = this.money(data[field]);
    return {
      dailyLoanNo: this.int(data.dailyLoanNo),
      dailyLoanAmount: v.dailyLoanAmount,
      weeklyLoanNo: this.int(data.weeklyLoanNo),
      weeklyLoanAmount: v.weeklyLoanAmount,
      monthlyLoanNo: this.int(data.monthlyLoanNo),
      monthlyLoanAmount: v.monthlyLoanAmount,
      bankDeposit: v.bankDeposit,
      savingWithdrawal: v.savingWithdrawal,
      savingReturned: v.savingReturned,
      savingAdjustment: v.savingAdjustment,
      fundTransferHeadOffice: v.fundTransferHeadOffice,
      fundTransferBranchOffice: v.fundTransferBranchOffice,
      otherAmount: v.otherAmount,
      expenseAmount: v.expenseAmount,
    };
  }

  async create(data: {
    periodId: string;
    branchId: string;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reference?: string;
    description?: string;
    entryDate?: string;
  }) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add cashbook entries to a closed period');
    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const amount = this.money(data.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    return this.prisma.cashbookEntry.create({
      data: { periodId: data.periodId, branchId: data.branchId, type: data.type, amount, reference: data.reference, description: data.description, entryDate: data.entryDate ? new Date(data.entryDate) : new Date() },
      include: { period: true, branch: true },
    });
  }

  async findAll(periodId?: string, branchId?: string) {
    return this.prisma.cashbookEntry.findMany({
      where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}) },
      orderBy: { entryDate: 'desc' },
      include: { period: true, branch: true },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.cashbookEntry.findUnique({ where: { id }, include: { period: true, branch: true } });
    if (!entry) throw new NotFoundException('Cashbook entry not found');
    return entry;
  }

  async summary(periodId?: string, branchId?: string) {
    const entries = await this.prisma.cashbookEntry.findMany({ where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}) } });
    const result = entries.reduce((summary, entry) => {
      if (entry.type === 'CASH_IN') summary.cashIn += entry.amount;
      else summary.cashOut += entry.amount;
      return summary;
    }, { cashIn: 0, cashOut: 0, balance: 0, entryCount: 0 });
    result.entryCount = entries.length;
    result.balance = result.cashIn - result.cashOut;
    return result;
  }

  async createDaily(data: CashbookDailyInput) {
    await this.ensureDailyTable();
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add entries to a closed period');
    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const v = this.values(data);
    const id = randomUUID();
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO cashbook_daily_records
      (id, period_id, branch_id, entry_date, description, daily_loan_no, daily_loan_amount,
       weekly_loan_no, weekly_loan_amount, monthly_loan_no, monthly_loan_amount, bank_deposit,
       saving_withdrawal, saving_returned, saving_adjustment, fund_transfer_head_office,
       fund_transfer_branch_office, other_amount, expense_amount, narration, reference_no)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
    `, id, data.periodId, data.branchId, data.entryDate ? new Date(data.entryDate) : new Date(), data.description ?? null,
      v.dailyLoanNo, v.dailyLoanAmount, v.weeklyLoanNo, v.weeklyLoanAmount, v.monthlyLoanNo, v.monthlyLoanAmount,
      v.bankDeposit, v.savingWithdrawal, v.savingReturned, v.savingAdjustment, v.fundTransferHeadOffice,
      v.fundTransferBranchOffice, v.otherAmount, v.expenseAmount, data.narration ?? null, data.referenceNo ?? null);
    return this.dailyOne(id);
  }

  async dailyOne(id: string) {
    await this.ensureDailyTable();
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT r.*, b.name AS branch_name, p.name AS period_name,
        (r.daily_loan_amount + r.weekly_loan_amount + r.monthly_loan_amount + r.bank_deposit +
         r.saving_withdrawal + r.saving_returned + r.saving_adjustment + r.fund_transfer_head_office +
         r.fund_transfer_branch_office + r.other_amount + r.expense_amount) AS total_amount
      FROM cashbook_daily_records r
      JOIN "Branch" b ON b.id = r.branch_id
      JOIN "FinancialPeriod" p ON p.id = r.period_id
      WHERE r.id = $1
    `, id);
    if (!rows[0]) throw new NotFoundException('Daily cashbook record not found');
    return this.mapDaily(rows[0]);
  }

  private mapDaily(row: any) {
    return {
      id: row.id,
      periodId: row.period_id,
      branchId: row.branch_id,
      entryDate: row.entry_date,
      description: row.description,
      dailyLoanNo: Number(row.daily_loan_no || 0), dailyLoanAmount: Number(row.daily_loan_amount || 0),
      weeklyLoanNo: Number(row.weekly_loan_no || 0), weeklyLoanAmount: Number(row.weekly_loan_amount || 0),
      monthlyLoanNo: Number(row.monthly_loan_no || 0), monthlyLoanAmount: Number(row.monthly_loan_amount || 0),
      bankDeposit: Number(row.bank_deposit || 0), savingWithdrawal: Number(row.saving_withdrawal || 0),
      savingReturned: Number(row.saving_returned || 0), savingAdjustment: Number(row.saving_adjustment || 0),
      fundTransferHeadOffice: Number(row.fund_transfer_head_office || 0), fundTransferBranchOffice: Number(row.fund_transfer_branch_office || 0),
      otherAmount: Number(row.other_amount || 0), expenseAmount: Number(row.expense_amount || 0),
      narration: row.narration, referenceNo: row.reference_no,
      totalAmount: Number(row.total_amount || 0), branch: { name: row.branch_name }, period: { name: row.period_name },
    };
  }

  async findDaily(periodId?: string, branchId?: string, from?: string, to?: string) {
    await this.ensureDailyTable();
    const conditions: string[] = [];
    const params: any[] = [];
    if (periodId) { params.push(periodId); conditions.push(`r.period_id = $${params.length}`); }
    if (branchId) { params.push(branchId); conditions.push(`r.branch_id = $${params.length}`); }
    if (from) { params.push(new Date(from)); conditions.push(`r.entry_date >= $${params.length}`); }
    if (to) { params.push(new Date(to)); conditions.push(`r.entry_date < $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT r.*, b.name AS branch_name, p.name AS period_name,
        (r.daily_loan_amount + r.weekly_loan_amount + r.monthly_loan_amount + r.bank_deposit +
         r.saving_withdrawal + r.saving_returned + r.saving_adjustment + r.fund_transfer_head_office +
         r.fund_transfer_branch_office + r.other_amount + r.expense_amount) AS total_amount
      FROM cashbook_daily_records r
      JOIN "Branch" b ON b.id = r.branch_id
      JOIN "FinancialPeriod" p ON p.id = r.period_id
      ${where}
      ORDER BY r.entry_date DESC, r.created_at DESC
    `, ...params);
    return rows.map(row => this.mapDaily(row));
  }

  async dailySummary(periodId?: string, branchId?: string, from?: string, to?: string) {
    const rows = await this.findDaily(periodId, branchId, from, to);
    const fields = ['dailyLoanAmount','weeklyLoanAmount','monthlyLoanAmount','bankDeposit','savingWithdrawal','savingReturned','savingAdjustment','fundTransferHeadOffice','fundTransferBranchOffice','otherAmount','expenseAmount'] as const;
    const totals: Record<string, number> = { records: rows.length, totalAmount: 0 };
    for (const field of fields) totals[field] = rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    totals.dailyLoanNo = rows.reduce((sum, row) => sum + Number(row.dailyLoanNo || 0), 0);
    totals.weeklyLoanNo = rows.reduce((sum, row) => sum + Number(row.weeklyLoanNo || 0), 0);
    totals.monthlyLoanNo = rows.reduce((sum, row) => sum + Number(row.monthlyLoanNo || 0), 0);
    totals.totalAmount = rows.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0);
    return totals;
  }

  async updateDaily(id: string, data: Partial<CashbookDailyInput>) {
    const existing = await this.dailyOne(id);
    const merged = { ...existing, ...data, periodId: data.periodId ?? existing.periodId, branchId: data.branchId ?? existing.branchId } as CashbookDailyInput;
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: merged.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot edit entries in a closed period');
    const v = this.values(merged);
    await this.prisma.$executeRawUnsafe(`
      UPDATE cashbook_daily_records SET period_id=$2, branch_id=$3, entry_date=$4, description=$5,
      daily_loan_no=$6, daily_loan_amount=$7, weekly_loan_no=$8, weekly_loan_amount=$9,
      monthly_loan_no=$10, monthly_loan_amount=$11, bank_deposit=$12, saving_withdrawal=$13,
      saving_returned=$14, saving_adjustment=$15, fund_transfer_head_office=$16,
      fund_transfer_branch_office=$17, other_amount=$18, expense_amount=$19, narration=$20,
      reference_no=$21, updated_at=CURRENT_TIMESTAMP WHERE id=$1
    `, id, merged.periodId, merged.branchId, merged.entryDate ? new Date(merged.entryDate) : existing.entryDate,
      merged.description ?? null, v.dailyLoanNo, v.dailyLoanAmount, v.weeklyLoanNo, v.weeklyLoanAmount,
      v.monthlyLoanNo, v.monthlyLoanAmount, v.bankDeposit, v.savingWithdrawal, v.savingReturned,
      v.savingAdjustment, v.fundTransferHeadOffice, v.fundTransferBranchOffice, v.otherAmount,
      v.expenseAmount, merged.narration ?? null, merged.referenceNo ?? null);
    return this.dailyOne(id);
  }

  async removeDaily(id: string) {
    const entry = await this.dailyOne(id);
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: entry.periodId } });
    if (period?.status === 'CLOSED') throw new BadRequestException('Cannot delete an entry from a closed period');
    await this.prisma.$executeRawUnsafe('DELETE FROM cashbook_daily_records WHERE id=$1', id);
    return { message: 'Daily cashbook record deleted successfully' };
  }

  async remove(id: string) {
    const entry = await this.findOne(id);
    if (entry.period.status === 'CLOSED') throw new BadRequestException('Cannot delete an entry from a closed period');
    await this.prisma.cashbookEntry.delete({ where: { id } });
    return { message: 'Cashbook entry deleted successfully' };
  }
}
