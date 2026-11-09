import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createFinancialReference } from '../common/financial-reference';

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


type CashbookActor = { id: string; role: string; staffId?: string | null };
type CashbookStaffProfile = {
  id: string; staffId: string; firstName: string; lastName: string; position: string;
  branchId: string; regionId: string | null; divisionId: string | null; areaId: string | null;
};
type CashbookScope =
  | { kind: 'all'; role: string; branchIds: string[]; staff?: undefined; canWrite: boolean }
  | { kind: 'branches'; role: string; branchIds: string[]; staff: CashbookStaffProfile; canWrite: boolean }
  | { kind: 'staff'; role: string; branchIds: string[]; staff: CashbookStaffProfile; canWrite: boolean };

const MONEY_FIELDS = [
  'previousCashAtHand','savingsDeposits','dailyCollection','weeklyCollection','monthlyCollection','monitorRegistrationFees','riskPremium','passbookSales','loanApplicationForm','withdrawalFromBank','fundReceivedHeadOffice','fundReceivedBranchOther','receiptOthers','fixedOther','otherIncome',
  'dailyDisbursementAmount','weeklyDisbursementAmount','monthlyDisbursementAmount','bankDeposit','savingsWithdrawalAmount','savingsReturnedDW','savingsReturnedD','savingsReturnedW','savingsReturnedCash','savingsReturnedAdjust','fundTransferHeadOffice','fundTransferBranch','others','otherAfterTotal',
] as const;
const COUNT_FIELDS = ['dailyDisbursementCount','weeklyDisbursementCount','monthlyDisbursementCount','savingsWithdrawalCount'] as const;
const ALL_FIELDS = [...MONEY_FIELDS, ...COUNT_FIELDS] as const;
const snake = (s: string) => s.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);

@Injectable()
export class CashbookService {
  constructor(private readonly prisma: PrismaService) {}


  private async accessScope(actor: CashbookActor, write = false): Promise<CashbookScope> {
    if (!actor?.id || !actor?.role) throw new UnauthorizedException('Sign in to access the cashbook.');
    const role = String(actor.role).toUpperCase();
    if (role === 'SUPER_ADMIN') return { kind: 'all', role, branchIds: [], canWrite: true };

    const writeRoles = ['ADMIN', 'BRANCH_MANAGER', 'AREA_MANAGER', 'DIVISIONAL_MANAGER', 'REGIONAL_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'];
    const readRoles = [...writeRoles, 'AUDITOR', 'MONITORING_TEAM'];
    if (!readRoles.includes(role)) throw new ForbiddenException('Your role is not permitted to access the cashbook.');
    const canWrite = writeRoles.includes(role);
    if (write && !canWrite) throw new ForbiddenException('Your role has read-only cashbook access.');

    const staffOr: any[] = [];
    if (actor.staffId) staffOr.push({ id: actor.staffId });
    staffOr.push({ userId: actor.id });
    const staff = await this.prisma.staff.findFirst({
      where: { OR: staffOr },
      select: { id: true, staffId: true, firstName: true, lastName: true, position: true, branchId: true, regionId: true, divisionId: true, areaId: true, employmentStatus: true },
    });
    if (!staff) throw new ForbiddenException('Your account is not linked to a staff profile. Ask an administrator to attach your Staff ID.');
    if (actor.staffId && String(actor.staffId) !== String(staff.id)) {
      throw new ForbiddenException('Your login Staff ID does not match the assigned staff profile. Contact Super Admin before using the cashbook.');
    }
    if (staff.employmentStatus !== 'ACTIVE') throw new ForbiddenException('Inactive staff accounts cannot access the cashbook.');

    const individualRoles = ['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'COLLECTOR', 'STAFF'];
    if (individualRoles.includes(role)) {
      return { kind: 'staff', role, staff, branchIds: [staff.branchId], canWrite };
    }

    const assignments = await this.prisma.staffAssignment.findMany({
      where: { staffId: staff.id, active: true },
      select: { branchId: true, areaId: true, divisionId: true, regionId: true, startsAt: true, endsAt: true },
    });
    const now = new Date();
    const active = assignments.filter((a) => a.startsAt <= now && (!a.endsAt || a.endsAt > now));
    const unique = (values: Array<string | null | undefined>): string[] =>
      [...new Set(values.filter((value): value is string => Boolean(value)))];
    const branchIds = role === 'ADMIN'
      ? [staff.branchId]
      : unique([staff.branchId, ...active.map((a) => a.branchId)]);
    const areaIds = unique([staff.areaId, ...active.map((a) => a.areaId)]);
    const divisionIds = unique([staff.divisionId, ...active.map((a) => a.divisionId)]);
    const regionIds = unique([staff.regionId, ...active.map((a) => a.regionId)]);
    const clauses: any[] = [];

    if (role === 'ADMIN' || role === 'BRANCH_MANAGER') {
      if (branchIds.length) clauses.push({ id: { in: branchIds } });
    } else if (role === 'AREA_MANAGER') {
      if (areaIds.length) clauses.push({ areaId: { in: areaIds } });
      if (branchIds.length) clauses.push({ id: { in: branchIds } });
    } else if (role === 'DIVISIONAL_MANAGER') {
      if (divisionIds.length) clauses.push({ divisionId: { in: divisionIds } });
      if (branchIds.length) clauses.push({ id: { in: branchIds } });
    } else if (role === 'REGIONAL_MANAGER') {
      if (regionIds.length) clauses.push({ regionId: { in: regionIds } });
      if (branchIds.length) clauses.push({ id: { in: branchIds } });
    } else if (role === 'AUDITOR' || role === 'MONITORING_TEAM') {
      if (branchIds.length) clauses.push({ id: { in: branchIds } });
      if (areaIds.length) clauses.push({ areaId: { in: areaIds } });
      if (divisionIds.length) clauses.push({ divisionId: { in: divisionIds } });
      if (regionIds.length) clauses.push({ regionId: { in: regionIds } });
    }

    if (!clauses.length) throw new ForbiddenException('No active branch assignment is configured for your cashbook access.');
    const branches = await this.prisma.branch.findMany({ where: { OR: clauses }, select: { id: true } });
    const allowed = branches.map((b) => b.id);
    if (!allowed.length) throw new ForbiddenException('No branch is assigned to your cashbook role.');
    return { kind: 'branches', role, staff, branchIds: allowed, canWrite };
  }

  private assertBranch(scope: CashbookScope, branchId?: string) {
    if (scope.kind === 'all') return;
    if (scope.kind === 'staff') {
      if (branchId && branchId !== scope.staff.branchId) throw new ForbiddenException('You can only access your assigned branch.');
      return;
    }
    if (branchId && !scope.branchIds.includes(branchId)) throw new ForbiddenException('The selected branch is outside your assigned scope.');
  }

  private async dailyIdentity(scope: CashbookScope, data: { branchId?: string; staffId?: string }) {
    if (scope.kind === 'staff') {
      const profile = scope.staff;
      if (data.branchId && data.branchId !== profile.branchId) throw new ForbiddenException('You can only post to your assigned branch.');
      if (data.staffId && data.staffId !== profile.id) throw new ForbiddenException('You can only post daily work under your own Staff ID.');
      return { branchId: profile.branchId, staffId: profile.id };
    }
    if (!data.branchId) throw new BadRequestException('A branch is required.');
    this.assertBranch(scope, data.branchId);
    if (!data.staffId) throw new BadRequestException('Select the staff member responsible for this daily work.');
    const assigned = await this.prisma.staff.findUnique({
      where: { id: data.staffId },
      select: { id: true, branchId: true, employmentStatus: true },
    });
    if (!assigned) throw new NotFoundException('Field staff not found.');
    if (assigned.branchId !== data.branchId) throw new ForbiddenException('The selected staff member does not belong to this branch.');
    if (assigned.employmentStatus !== 'ACTIVE') throw new ForbiddenException('Inactive staff cannot post daily cashbook work.');
    return { branchId: assigned.branchId, staffId: assigned.id };
  }

  async getAccess(actor: CashbookActor) {
    const scope = await this.accessScope(actor);
    const branches = await this.prisma.branch.findMany({
      where: scope.kind === 'all' ? {} : { id: { in: scope.branchIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    const ids = branches.map((b) => b.id);
    const staff = scope.kind === 'staff'
      ? [scope.staff]
      : await this.prisma.staff.findMany({
          where: { branchId: { in: ids }, employmentStatus: 'ACTIVE' },
          select: { id: true, staffId: true, firstName: true, lastName: true, position: true, branchId: true },
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });
    const periods = await this.prisma.financialPeriod.findMany({
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: { startDate: 'desc' },
    });
    const preferredBranchId = scope.staff && ids.includes(scope.staff.branchId)
      ? scope.staff.branchId
      : branches[0]?.id || '';
    const currentStaff = scope.staff
      ? { id: scope.staff.id, staffId: scope.staff.staffId, firstName: scope.staff.firstName, lastName: scope.staff.lastName, position: scope.staff.position, branchId: scope.staff.branchId }
      : null;
    return {
      role: scope.role,
      selfOnly: scope.kind === 'staff',
      canWrite: scope.canWrite,
      canSelectBranch: scope.kind !== 'staff' && branches.length > 1,
      canSelectStaff: scope.kind !== 'staff',
      branchId: preferredBranchId,
      staffId: scope.kind === 'staff' ? scope.staff.id : null,
      currentStaff,
      branches,
      staff,
      periods,
    };
  }

  private async openingBalanceFor(branchId: string, staffId: string, entryDate: Date) {
    const startOfDay = new Date(Date.UTC(entryDate.getUTCFullYear(), entryDate.getUTCMonth(), entryDate.getUTCDate()));
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT other_after_total FROM cashbook_daily_records WHERE branch_id=$1 AND staff_id=$2 AND entry_date < $3 ORDER BY entry_date DESC, created_at DESC LIMIT 1',
      branchId, staffId, startOfDay,
    );
    return Number(rows[0]?.other_after_total || 0);
  }

  async getOpeningBalance(actor: CashbookActor, branchId?: string, staffId?: string, entryDate?: string) {
    const scope = await this.accessScope(actor);
    const identity = await this.dailyIdentity(scope, { branchId, staffId });
    const date = entryDate ? new Date(entryDate) : new Date();
    if (!Number.isFinite(date.getTime())) throw new BadRequestException('A valid cashbook date is required.');
    return { balance: await this.openingBalanceFor(identity.branchId, identity.staffId, date) };
  }

  private async assertDailyRowAccess(row: any, scope: CashbookScope) {
    if (scope.kind === 'staff' && row.staff_id !== scope.staff.id) {
      throw new ForbiddenException('You can only access daily cashbook records linked to your Staff ID.');
    }
    if (scope.kind === 'branches' && !scope.branchIds.includes(row.branch_id)) {
      throw new ForbiddenException('This cashbook record is outside your assigned branch scope.');
    }
  }

  private number(value: unknown, label = 'Amount') { const n = Number(value ?? 0); if (!Number.isFinite(n) || n < 0) throw new BadRequestException(`${label} must be zero or greater`); return n; }

  private values(data: CashbookDailyInput) { const v:any = {}; for (const f of ALL_FIELDS) v[f] = this.number(data[f], f); return v; }
  private totals(r:any) {
    const receipts = ['previousCashAtHand','savingsDeposits','dailyCollection','weeklyCollection','monthlyCollection','monitorRegistrationFees','riskPremium','passbookSales','loanApplicationForm','withdrawalFromBank','fundReceivedHeadOffice','fundReceivedBranchOther','receiptOthers'];
    const payments = ['dailyDisbursementAmount','weeklyDisbursementAmount','monthlyDisbursementAmount','bankDeposit','savingsWithdrawalAmount','savingsReturnedD','savingsReturnedW','savingsReturnedCash','savingsReturnedAdjust','fundTransferHeadOffice','fundTransferBranch','others'];
    const totalReceipts = receipts.reduce((s,k)=>s+Number(r[k]||0),0);
    const totalPayments = payments.reduce((s,k)=>s+Number(r[k]||0),0);
    return { totalReceipts, totalPayments, netAmount: totalReceipts-totalPayments };
  }


  async create(data: any, actor: CashbookActor) {
    const scope = await this.accessScope(actor, true);
    if (scope.kind === 'staff') throw new ForbiddenException('Staff daily work must be posted through the assigned daily register.');
    this.assertBranch(scope, data.branchId);
    const p = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!p) throw new NotFoundException('Financial period not found');
    if (p.status === 'CLOSED') throw new BadRequestException('Cannot add cashbook entries to a closed period');
    const b = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!b) throw new NotFoundException('Branch not found');
    const amount = this.number(data.amount);
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    return this.prisma.cashbookEntry.create({
      data: { periodId: data.periodId, branchId: data.branchId, type: data.type, amount, reference: data.reference?.trim() || createFinancialReference('PWFB-CB'), description: data.description, entryDate: data.entryDate ? new Date(data.entryDate) : new Date() },
      include: { period: true, branch: true },
    });
  }

  private legacyBranchWhere(scope: CashbookScope, branchId?: string) {
    this.assertBranch(scope, branchId);
    if (scope.kind === 'all') return branchId ? { branchId } : {};
    if (scope.kind === 'staff') throw new ForbiddenException('Staff daily work must use the assigned daily register.');
    if (branchId) return { branchId };
    return { branchId: { in: scope.branchIds } };
  }

  async findAll(periodId: string | undefined, branchId: string | undefined, actor: CashbookActor) {
    const scope = await this.accessScope(actor);
    return this.prisma.cashbookEntry.findMany({
      where: { ...this.legacyBranchWhere(scope, branchId), ...(periodId ? { periodId } : {}) },
      orderBy: { entryDate: 'desc' },
      include: { period: true, branch: true },
    });
  }

  async findOne(id: string, actor: CashbookActor) {
    const scope = await this.accessScope(actor);
    const entry = await this.prisma.cashbookEntry.findUnique({ where: { id }, include: { period: true, branch: true } });
    if (!entry) throw new NotFoundException('Cashbook entry not found');
    this.assertBranch(scope, entry.branchId);
    if (scope.kind === 'staff') throw new ForbiddenException('Staff daily work must use the assigned daily register.');
    return entry;
  }

  async summary(periodId: string | undefined, branchId: string | undefined, actor: CashbookActor) {
    const scope = await this.accessScope(actor);
    const rows = await this.prisma.cashbookEntry.findMany({
      where: { ...this.legacyBranchWhere(scope, branchId), ...(periodId ? { periodId } : {}) },
    });
    const cashIn = rows.filter((r) => r.type === 'CASH_IN').reduce((s, r) => s + r.amount, 0);
    const cashOut = rows.filter((r) => r.type === 'CASH_OUT').reduce((s, r) => s + r.amount, 0);
    return { cashIn, cashOut, balance: cashIn - cashOut, entryCount: rows.length };
  }

  private map(r: any) {
    const out: any = {
      id: r.id, periodId: r.period_id, branchId: r.branch_id, staffId: r.staff_id || undefined,
      entryDate: r.entry_date, description: r.description, narration: r.narration, referenceNo: r.reference_no,
      branch: { name: r.branch_name }, period: { name: r.period_name },
      staff: r.staff_id ? { id: r.staff_id, staffId: r.staff_code, firstName: r.staff_first_name, lastName: r.staff_last_name, position: r.staff_position } : undefined,
    };
    for (const f of ALL_FIELDS) out[f] = Number(r[snake(f)] || 0);
    return { ...out, ...this.totals(out) };
  }


  async createDaily(data: CashbookDailyInput, actor: CashbookActor) {
    const scope = await this.accessScope(actor, true);
    const identity = await this.dailyIdentity(scope, data);
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add entries to a closed period');
    const branch = await this.prisma.branch.findUnique({ where: { id: identity.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const selectedDate = data.entryDate ? new Date(data.entryDate) : new Date();
    if (!Number.isFinite(selectedDate.getTime())) throw new BadRequestException('A valid cashbook date is required.');
    const values = this.values(data);
    values.previousCashAtHand = await this.openingBalanceFor(identity.branchId, identity.staffId, selectedDate);
    const id = randomUUID();
    const rowTotals = this.totals(values);
    values.otherAfterTotal = Math.max(0, rowTotals.totalReceipts - rowTotals.totalPayments);
    const columns = ALL_FIELDS.map(snake);
    const params = [
      id, data.periodId, identity.branchId, identity.staffId, selectedDate, data.description ?? null,
      ...ALL_FIELDS.map(field => values[field]), data.narration ?? null, data.referenceNo?.trim() || createFinancialReference('PWFB-DAILY'),
    ];
    const placeholders = params.map((_, index) => '$' + (index + 1));
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO cashbook_daily_records (id,period_id,branch_id,staff_id,entry_date,description,' + columns.join(',') + ',narration,reference_no) VALUES (' + placeholders.join(',') + ')',
      ...params,
    );
    return this.dailyOne(id, actor);
  }

  async dailyOne(id: string, actor: CashbookActor) {
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT r.*, b.name AS branch_name, p.name AS period_name, s."staffId" AS staff_code, s."firstName" AS staff_first_name, s."lastName" AS staff_last_name, s.position AS staff_position FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id LEFT JOIN "Staff" s ON s.id=r.staff_id WHERE r.id=$1',
      id,
    );
    if (!rows[0]) throw new NotFoundException('Daily cashbook record not found');
    const scope = await this.accessScope(actor);
    await this.assertDailyRowAccess(rows[0], scope);
    return this.map(rows[0]);
  }

  async findDaily(periodId: string | undefined, branchId: string | undefined, from: string | undefined, to: string | undefined, actor: CashbookActor) {
    const scope = await this.accessScope(actor);
    this.assertBranch(scope, branchId);
    const clauses: string[] = [];
    const params: any[] = [];
    if (periodId) { params.push(periodId); clauses.push('r.period_id=$' + params.length); }
    if (branchId) { params.push(branchId); clauses.push('r.branch_id=$' + params.length); }
    if (from) {
      const date = new Date(from);
      if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid start date.');
      params.push(date); clauses.push('r.entry_date>=$' + params.length);
    }
    if (to) {
      const date = new Date(to);
      if (!Number.isFinite(date.getTime())) throw new BadRequestException('Invalid end date.');
      params.push(date); clauses.push('r.entry_date<=$' + params.length);
    }
    if (scope.kind === 'staff') {
      params.push(scope.staff.id);
      clauses.push('r.staff_id=$' + params.length);
    } else if (scope.kind === 'branches' && !branchId) {
      const slots = scope.branchIds.map(id => { params.push(id); return '$' + params.length; });
      clauses.push('r.branch_id IN (' + slots.join(',') + ')');
    }
    const rows: any[] = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT r.*, b.name AS branch_name, p.name AS period_name, s."staffId" AS staff_code, s."firstName" AS staff_first_name, s."lastName" AS staff_last_name, s.position AS staff_position FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id LEFT JOIN "Staff" s ON s.id=r.staff_id ' +
      (clauses.length ? 'WHERE ' + clauses.join(' AND ') : '') +
      ' ORDER BY r.entry_date DESC, r.created_at DESC',
      ...params,
    );
    return rows.map(row => this.map(row));
  }

  async dailySummary(periodId: string | undefined, branchId: string | undefined, from: string | undefined, to: string | undefined, actor: CashbookActor) {
    const rows = await this.findDaily(periodId, branchId, from, to, actor);
    const totals: Record<string, number> = { records: rows.length };
    for (const field of ALL_FIELDS) totals[field] = rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
    totals.totalReceipts = rows.reduce((sum, row) => sum + Number(row.totalReceipts || 0), 0);
    totals.totalPayments = rows.reduce((sum, row) => sum + Number(row.totalPayments || 0), 0);
    totals.netAmount = totals.totalReceipts - totals.totalPayments;
    return totals;
  }

  async updateDaily(id: string, _data: Partial<CashbookDailyInput>, actor: CashbookActor) {
    await this.dailyOne(id, actor);
    throw new BadRequestException('Daily cashbook records are immutable. Create a correcting cashbook entry instead of editing the original record.');
  }

  async removeDaily(id: string, actor: CashbookActor) {
    await this.dailyOne(id, actor);
    throw new BadRequestException('Daily cashbook records are immutable and cannot be deleted. Create a correcting cashbook entry instead.');
  }

  async remove(id: string, actor: CashbookActor) {
    await this.findOne(id, actor);
    throw new BadRequestException('Cashbook entries are immutable and cannot be deleted. Create a correcting cashbook entry instead.');
  }
}
