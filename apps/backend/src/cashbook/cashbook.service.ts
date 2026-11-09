import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CashbookDailyInput = {
  periodId: string; branchId: string; staffId?: string; entryDate?: string; description?: string; narration?: string; referenceNo?: string;
  previousCashAtHand?: number;
  savingsDeposits?: number; dailyCollection?: number; weeklyCollection?: number; monthlyCollection?: number;
  monitorRegistrationFees?: number; riskPremium?: number; passbookSales?: number; loanApplicationForm?: number;
  withdrawalFromBank?: number; fundReceivedHeadOffice?: number; fundReceivedBranchOther?: number; receiptOthers?: number;
  fixedOther?: number; otherIncome?: number;
  dailyDisbursementCount?: number; dailyDisbursementAmount?: number;
  weeklyDisbursementCount?: number; weeklyDisbursementAmount?: number;
  monthlyDisbursementCount?: number; monthlyDisbursementAmount?: number;
  bankDeposit?: number; savingsWithdrawalCount?: number; savingsWithdrawalAmount?: number;
  savingsReturnedDW?: number; savingsReturnedD?: number; savingsReturnedW?: number; savingsReturnedCash?: number; savingsReturnedAdjust?: number;
  fundTransferHeadOffice?: number; fundTransferBranch?: number; others?: number; otherAfterTotal?: number;
};

const MONEY_FIELDS = [
  'previousCashAtHand','savingsDeposits','dailyCollection','weeklyCollection','monthlyCollection','monitorRegistrationFees','riskPremium','passbookSales','loanApplicationForm',
  'withdrawalFromBank','fundReceivedHeadOffice','fundReceivedBranchOther','receiptOthers','fixedOther','otherIncome',
  'dailyDisbursementAmount','weeklyDisbursementAmount','monthlyDisbursementAmount','bankDeposit','savingsWithdrawalAmount',
  'savingsReturnedDW','savingsReturnedD','savingsReturnedW','savingsReturnedCash','savingsReturnedAdjust',
  'fundTransferHeadOffice','fundTransferBranch','others','otherAfterTotal',
] as const;
const COUNT_FIELDS = ['dailyDisbursementCount','weeklyDisbursementCount','monthlyDisbursementCount','savingsWithdrawalCount'] as const;
const ALL_FIELDS = [...MONEY_FIELDS, ...COUNT_FIELDS] as const;
const snake = (s: string) => s.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);

@Injectable()
export class CashbookService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private number(value: unknown, label = 'Amount') { const n = Number(value ?? 0); if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${label} must be zero or greater`); return n; }

  private async ensureDailyTable() {
    if (!this.ready) this.ready = this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS cashbook_daily_records (
        id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES "FinancialPeriod"(id), branch_id TEXT NOT NULL REFERENCES "Branch"(id), staff_id TEXT,
        entry_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, description TEXT,
        previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0, daily_collection DOUBLE PRECISION NOT NULL DEFAULT 0, weekly_collection DOUBLE PRECISION NOT NULL DEFAULT 0, monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0,
        monitor_registration_fees DOUBLE PRECISION NOT NULL DEFAULT 0, risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0, passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0, loan_application_form DOUBLE PRECISION NOT NULL DEFAULT 0,
        withdrawal_from_bank DOUBLE PRECISION NOT NULL DEFAULT 0, fund_received_head_office DOUBLE PRECISION NOT NULL DEFAULT 0, fund_received_branch_other DOUBLE PRECISION NOT NULL DEFAULT 0, receipt_others DOUBLE PRECISION NOT NULL DEFAULT 0,
        fixed_other DOUBLE PRECISION NOT NULL DEFAULT 0, other_income DOUBLE PRECISION NOT NULL DEFAULT 0,
        daily_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0, daily_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        weekly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0, weekly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        monthly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0, monthly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0, savings_withdrawal_count DOUBLE PRECISION NOT NULL DEFAULT 0, savings_withdrawal_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_returned_d_w DOUBLE PRECISION NOT NULL DEFAULT 0, savings_returned_d DOUBLE PRECISION NOT NULL DEFAULT 0, savings_returned_w DOUBLE PRECISION NOT NULL DEFAULT 0, savings_returned_cash DOUBLE PRECISION NOT NULL DEFAULT 0, savings_returned_adjust DOUBLE PRECISION NOT NULL DEFAULT 0,
        fund_transfer_head_office DOUBLE PRECISION NOT NULL DEFAULT 0, fund_transfer_branch DOUBLE PRECISION NOT NULL DEFAULT 0, others DOUBLE PRECISION NOT NULL DEFAULT 0,
        narration TEXT, reference_no TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS staff_id TEXT;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monitor_registration_fees DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS loan_application_form DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS withdrawal_from_bank DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_received_head_office DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_received_branch_other DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS receipt_others DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fixed_other DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS other_income DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS weekly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_disbursement_count DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_disbursement_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_withdrawal_count DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_withdrawal_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_d_w DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_d DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_w DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_cash DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_adjust DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_transfer_head_office DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_transfer_branch DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS others DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS other_after_total DOUBLE PRECISION NOT NULL DEFAULT 0;
    `).then(() => undefined).catch(e => { this.ready = null; throw e; });
    await this.ready;
  }

  private values(data: CashbookDailyInput) { const v:any = {}; for (const f of ALL_FIELDS) v[f] = this.number(data[f], f); return v; }
  private totals(r:any) {
    const receipts = ['previousCashAtHand','savingsDeposits','dailyCollection','weeklyCollection','monthlyCollection','monitorRegistrationFees','riskPremium','passbookSales','loanApplicationForm','withdrawalFromBank','fundReceivedHeadOffice','fundReceivedBranchOther','receiptOthers','fixedOther','otherIncome'];
    const payments = ['dailyDisbursementAmount','weeklyDisbursementAmount','monthlyDisbursementAmount','bankDeposit','savingsWithdrawalAmount','savingsReturnedDW','savingsReturnedD','savingsReturnedW','savingsReturnedCash','savingsReturnedAdjust','fundTransferHeadOffice','fundTransferBranch','others'];
    const totalReceipts = receipts.reduce((s,k)=>s+Number(r[k]||0),0);
    const totalPayments = payments.reduce((s,k)=>s+Number(r[k]||0),0);
    return { totalReceipts, totalPayments, netAmount: totalReceipts-totalPayments };
  }

  async create(data: any) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add cashbook entries to a closed period');
    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (data.type !== 'CASH_IN' && data.type !== 'CASH_OUT') {
      throw new BadRequestException('Cashbook entry type must be CASH_IN or CASH_OUT');
    }
    const amount = this.number(data.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
    if (Number.isNaN(entryDate.getTime())) throw new BadRequestException('A valid cashbook entry date is required');
    if (entryDate < new Date(period.startDate) || entryDate > new Date(period.endDate)) {
      throw new BadRequestException('Cashbook entry date must fall inside the selected financial period');
    }

    const reference = String(data.reference || '').trim() || `MANUAL-CASHBOOK-${randomUUID()}`;
    return this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe('SELECT id FROM "FinancialPeriod" WHERE id = $1 FOR UPDATE', data.periodId);
      const lockedPeriod = await tx.financialPeriod.findUnique({ where: { id: data.periodId } });
      if (!lockedPeriod) throw new NotFoundException('Financial period not found');
      if (lockedPeriod.status === 'CLOSED') throw new BadRequestException('Cannot add cashbook entries to a closed period');
      if (entryDate < new Date(lockedPeriod.startDate) || entryDate > new Date(lockedPeriod.endDate)) {
        throw new BadRequestException('Cashbook entry date must fall inside the selected financial period');
      }
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        `CASHBOOK-ENTRY:${data.branchId}:${reference}`,
      );
      const duplicate = await tx.cashbookEntry.findFirst({
        where: { branchId: data.branchId, reference },
        select: { id: true },
      });
      if (duplicate) throw new BadRequestException('This cashbook reference has already been recorded for the selected branch');
      return tx.cashbookEntry.create({
        data: {
          periodId: data.periodId,
          branchId: data.branchId,
          type: data.type,
          amount,
          reference,
          description: data.description,
          entryDate,
        },
        include: { period: true, branch: true },
      });
    });
  }
  async findAll(periodId?:string,branchId?:string){return this.prisma.cashbookEntry.findMany({where:{...(periodId?{periodId}:{}),...(branchId?{branchId}:{})},orderBy:{entryDate:'desc'},include:{period:true,branch:true}})}
  async findOne(id:string){const e=await this.prisma.cashbookEntry.findUnique({where:{id},include:{period:true,branch:true}});if(!e)throw new NotFoundException('Cashbook entry not found');return e;}
  async summary(periodId?:string,branchId?:string){const rows=await this.prisma.cashbookEntry.findMany({where:{...(periodId?{periodId}:{}),...(branchId?{branchId}:{})}});const cashIn=rows.filter(r=>r.type==='CASH_IN').reduce((s,r)=>s+r.amount,0),cashOut=rows.filter(r=>r.type==='CASH_OUT').reduce((s,r)=>s+r.amount,0);return{cashIn,cashOut,balance:cashIn-cashOut,entryCount:rows.length};}

  private map(r:any){const out:any={id:r.id,periodId:r.period_id,branchId:r.branch_id,staffId:r.staff_id||undefined,entryDate:r.entry_date,description:r.description,narration:r.narration,referenceNo:r.reference_no,branch:{name:r.branch_name},period:{name:r.period_name}};for(const f of ALL_FIELDS)out[f]=Number(r[snake(f)]||0);return {...out,...this.totals(out)};}

  async createDaily(data: CashbookDailyInput) {
    await this.ensureDailyTable();
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add entries to a closed period');
    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    if (data.staffId) {
      const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId } });
      if (!staff) throw new NotFoundException('Field staff not found');
      if (staff.employmentStatus !== 'ACTIVE') throw new BadRequestException('Daily cashbook posting requires an active staff member');
      if (staff.branchId !== data.branchId) throw new BadRequestException('Field staff must belong to the selected branch');
    }

    const entryDate = data.entryDate ? new Date(data.entryDate) : new Date();
    if (Number.isNaN(entryDate.getTime())) throw new BadRequestException('A valid cashbook entry date is required');
    const dayKey = entryDate.toISOString().slice(0, 10);
    const periodStart = new Date(period.startDate).toISOString().slice(0, 10);
    const periodEnd = new Date(period.endDate).toISOString().slice(0, 10);
    if (dayKey < periodStart || dayKey > periodEnd) {
      throw new BadRequestException('Cashbook work date must fall inside the selected financial period');
    }

    const id = randomUUID();
    const columns = ALL_FIELDS.map(snake);
    await this.prisma.$transaction(async (tx: any) => {
      // Lock the accounting period so period closure cannot race a cashbook post.
      await tx.$queryRawUnsafe('SELECT id FROM "FinancialPeriod" WHERE id = $1 FOR UPDATE', data.periodId);
      const lockedPeriod = await tx.financialPeriod.findUnique({ where: { id: data.periodId } });
      if (!lockedPeriod) throw new NotFoundException('Financial period not found');
      if (lockedPeriod.status === 'CLOSED') throw new BadRequestException('Cannot add entries to a closed period');
      const lockedStart = new Date(lockedPeriod.startDate).toISOString().slice(0, 10);
      const lockedEnd = new Date(lockedPeriod.endDate).toISOString().slice(0, 10);
      if (dayKey < lockedStart || dayKey > lockedEnd) {
        throw new BadRequestException('Cashbook work date must fall inside the selected financial period');
      }

      // Serialize postings for this branch/collector before reading the prior
      // closing balance. This prevents two requests from using the same opening cash.
      const lockKey = `DAILY-CASHBOOK:${data.branchId}:${data.staffId || 'UNASSIGNED'}`;
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', lockKey);

      const latestRows = await tx.$queryRawUnsafe(
        `SELECT MAX(entry_date::date)::text AS "latestDay"
         FROM cashbook_daily_records
         WHERE branch_id=$1 AND staff_id IS NOT DISTINCT FROM $2`,
        data.branchId, data.staffId || null,
      );
      const latestDay = String(latestRows[0]?.latestDay || '').slice(0, 10);
      if (latestDay && latestDay > dayKey) {
        throw new BadRequestException('Daily cashbook work must be posted in date order. Use a correcting-entry workflow for earlier dates.');
      }

      const duplicateRows = await tx.$queryRawUnsafe(
        `SELECT id FROM cashbook_daily_records
         WHERE branch_id=$1 AND staff_id IS NOT DISTINCT FROM $2 AND entry_date::date=$3::date
         LIMIT 1`,
        data.branchId, data.staffId || null, dayKey,
      );
      if (duplicateRows.length) {
        throw new BadRequestException('A daily cashbook record already exists for this Staff ID, branch and date. Use a correcting-entry workflow instead of posting a duplicate.');
      }

      const previousRows = await tx.$queryRawUnsafe(
        `SELECT other_after_total FROM cashbook_daily_records
         WHERE branch_id=$1 AND staff_id IS NOT DISTINCT FROM $2 AND entry_date < $3
         ORDER BY entry_date DESC, created_at DESC LIMIT 1`,
        data.branchId, data.staffId || null, entryDate,
      );
      const openingCash = Number(previousRows[0]?.other_after_total ?? 0);
      if (!Number.isFinite(openingCash) || openingCash < 0) {
        throw new BadRequestException('The previous cashbook closing balance is invalid. Reconcile the previous record before posting.');
      }

      const values = this.values({ ...data, previousCashAtHand: openingCash });
      const rowTotals = this.totals(values);
      const closingCash = Math.round((rowTotals.totalReceipts - rowTotals.totalPayments) * 100) / 100;
      if (!Number.isFinite(closingCash) || closingCash < 0) {
        throw new BadRequestException('Cashbook payments exceed available cash. Reconcile the deficit before posting.');
      }
      values.otherAfterTotal = closingCash;

      const params: any[] = [
        id, data.periodId, data.branchId, data.staffId ?? null, entryDate, data.description ?? null,
        ...ALL_FIELDS.map((field) => values[field]), data.narration ?? null, data.referenceNo ?? null,
      ];
      const placeholders = params.map((_, index) => `${index + 1}`);
      await tx.$executeRawUnsafe(
        `INSERT INTO cashbook_daily_records (id,period_id,branch_id,staff_id,entry_date,description,${columns.join(',')},narration,reference_no) VALUES (${placeholders.join(',')})`,
        ...params,
      );
    });

    return this.dailyOne(id);
  }
  async dailyOne(id:string){await this.ensureDailyTable();const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT r.*,b.name AS branch_name,p.name AS period_name FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id WHERE r.id=$1`,id);if(!rows[0])throw new NotFoundException('Daily cashbook record not found');return this.map(rows[0]);}
  async findDaily(periodId?:string,branchId?:string,from?:string,to?:string){await this.ensureDailyTable();const c:string[]=[],p:any[]=[];if(periodId){p.push(periodId);c.push(`r.period_id=$${p.length}`)}if(branchId){p.push(branchId);c.push(`r.branch_id=$${p.length}`)}if(from){p.push(new Date(from));c.push(`r.entry_date>=$${p.length}`)}if(to){p.push(new Date(to));c.push(`r.entry_date<=$${p.length}`)}const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT r.*,b.name AS branch_name,p.name AS period_name FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id ${c.length?'WHERE '+c.join(' AND '):''} ORDER BY r.entry_date DESC,r.created_at DESC`,...p);return rows.map(r=>this.map(r));}
  async dailySummary(periodId?:string,branchId?:string,from?:string,to?:string){const rows=await this.findDaily(periodId,branchId,from,to),totals:any={records:rows.length};for(const f of ALL_FIELDS)totals[f]=rows.reduce((s,r)=>s+Number(r[f]||0),0);totals.totalReceipts=rows.reduce((s,r)=>s+Number(r.totalReceipts||0),0);totals.totalPayments=rows.reduce((s,r)=>s+Number(r.totalPayments||0),0);totals.netAmount=totals.totalReceipts-totals.totalPayments;return totals;}
  async updateDaily(id:string,_data:Partial<CashbookDailyInput>){await this.dailyOne(id);throw new BadRequestException('Daily cashbook records are immutable. Create a correcting cashbook entry instead of editing the original record.');}
  async removeDaily(id:string){await this.dailyOne(id);throw new BadRequestException('Daily cashbook records are immutable and cannot be deleted. Create a correcting cashbook entry instead.');}
  async remove(id:string){await this.findOne(id);throw new BadRequestException('Cashbook entries are immutable and cannot be deleted. Create a correcting cashbook entry instead.');}
}
