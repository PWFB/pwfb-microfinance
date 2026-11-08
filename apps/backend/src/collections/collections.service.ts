import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StaffWalletService } from '../staff-wallet/staff-wallet.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService, private readonly staffWallet: StaffWalletService) {}

  private async ensureAllocationTable(tx: any = this.prisma) {
    await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" ("repaymentId" TEXT PRIMARY KEY,"principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  }

  private async allocateLoanRepayment(tx: any, loanId: string, repaymentId: string, amount: number) {
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    const interestAmount = Number(loan.amount || 0) * Number(loan.interestRate || 0) / 100;
    const prior = await tx.$queryRawUnsafe(`SELECT COALESCE(SUM("interestPaid"),0) AS "interestPaid", COALESCE(SUM("principalPaid"),0) AS "principalPaid" FROM "PWFBRepaymentAllocation" a JOIN "Repayment" r ON r.id=a."repaymentId" WHERE r."loanId"=$1 AND r.id<>$2`, loanId, repaymentId) as Array<{ interestPaid: number | string; principalPaid: number | string }>;
    const priorInterest = Number(prior[0]?.interestPaid || 0), priorPrincipal = Number(prior[0]?.principalPaid || 0);
    const interestRemaining = Math.max(0, interestAmount - priorInterest), principalRemaining = Math.max(0, Number(loan.amount || 0) - priorPrincipal);
    const interestPaid = Math.min(amount, interestRemaining), principalPaid = Math.min(Math.max(0, amount - interestPaid), principalRemaining);
    if (Math.round((interestPaid + principalPaid) * 100) / 100 < Math.round(amount * 100) / 100) throw new BadRequestException(`Repayment exceeds the outstanding loan balance. Outstanding: ₦${(interestRemaining + principalRemaining).toFixed(2)}`);
    await tx.$executeRawUnsafe(`INSERT INTO "PWFBRepaymentAllocation" ("repaymentId","principalPaid","interestPaid","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT ("repaymentId") DO UPDATE SET "principalPaid"=$2,"interestPaid"=$3,"updatedAt"=CURRENT_TIMESTAMP`, repaymentId, principalPaid, interestPaid);
    return { principalPaid, interestPaid, principalOutstanding: Math.max(0, principalRemaining - principalPaid), interestOutstanding: Math.max(0, interestRemaining - interestPaid) };
  }

  private async resolveSettlementTarget(customerId: string, type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER') {
    if (type === 'OTHER') return undefined;
    if (type === 'SAVINGS') {
      const accounts = await this.prisma.savings.findMany({ where: { customerId }, orderBy: { createdAt: 'asc' } });
      if (!accounts.length) throw new BadRequestException('This customer has no savings account. Create the savings account before settling the collection.');
      if (accounts.length > 1) throw new BadRequestException('This customer has multiple savings accounts. Open Collections and select the exact account before settling.');
      return accounts[0].id;
    }
    const loans = await this.prisma.loan.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
    const active = loans.filter((loan: any) => !loan.status || !['CLOSED', 'PAID', 'COMPLETED', 'REJECTED'].includes(String(loan.status).toUpperCase()));
    if (!active.length) throw new BadRequestException('This customer has no active loan. Create or approve a loan before recording a loan repayment.');
    if (active.length > 1) throw new BadRequestException('This customer has multiple active loans. Open Collections and select the exact loan before settling.');
    return active[0].id;
  }

  async create(data: { periodId: string; branchId: string; staffId: string; customerId: string; type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER'; amount: number; reference?: string; notes?: string; collectionDate?: string; settleNow?: boolean }) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Collection amount must be greater than zero');
    const reference = String(data.reference || '').trim() || `COL-${randomUUID()}`;
    if (reference.length > 120) throw new BadRequestException('Collection reference is too long');

    const created = await this.prisma.$transaction(async tx => {
      // Serialize requests sharing the same reference and reject duplicate submissions.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', 'DAILY-COLLECTION-REFERENCE:' + reference);
      const existing = await tx.dailyCollection.findFirst({ where: { reference }, select: { id: true } });
      if (existing) throw new BadRequestException('This collection reference has already been recorded');

      const period = await tx.financialPeriod.findUnique({ where: { id: data.periodId } });
      if (!period) throw new NotFoundException('Financial period not found');
      if (period.status === 'CLOSED') throw new BadRequestException('Cannot add collections to a closed period');
      const branch = await tx.branch.findUnique({ where: { id: data.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');
      const staff = await tx.staff.findUnique({ where: { id: data.staffId } });
      if (!staff) throw new NotFoundException('Collector/staff not found');
      if (staff.employmentStatus !== 'ACTIVE') throw new BadRequestException('Collector must be an active staff member');
      if (staff.branchId !== data.branchId) throw new BadRequestException('Selected staff does not belong to the selected branch');
      const customer = await tx.customer.findUnique({ where: { id: data.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
      if (customer.branchId !== data.branchId) throw new BadRequestException('Collection customer must belong to the selected collection branch');

      return tx.dailyCollection.create({
        data: {
          periodId: data.periodId,
          branchId: data.branchId,
          staffId: data.staffId,
          customerId: data.customerId,
          type: data.type,
          amount,
          reference,
          notes: data.notes,
          collectionDate: data.collectionDate ? new Date(data.collectionDate) : new Date(),
        },
        include: { period: true, branch: true, staff: true, customer: true },
      });
    });

    if (!data.settleNow) return created;
    const targetId = await this.resolveSettlementTarget(data.customerId, data.type);
    return this.settle(created.id, targetId);
  }

  async findAll(periodId?: string, branchId?: string, staffId?: string, type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER', branchIds?: string[] | null) {
    const branchFilter = branchId ? { branchId } : branchIds ? { branchId: { in: branchIds } } : {};
    if (branchIds && !branchIds.length && !branchId) return [];
    return this.prisma.dailyCollection.findMany({
      where: { ...(periodId ? { periodId } : {}), ...branchFilter, ...(staffId ? { staffId } : {}), ...(type ? { type } : {}) },
      orderBy: { collectionDate: 'desc' },
      include: {
        period: true, branch: true,
        staff: { select: { id: true, staffId: true, firstName: true, lastName: true, branchId: true } },
        customer: true,
      },
    });
  }

  async findOne(id: string) {
    const collection = await this.prisma.dailyCollection.findUnique({ where: { id }, include: { period: true, branch: true, staff: true, customer: true } });
    if (!collection) throw new NotFoundException('Daily collection not found');
    return collection;
  }

  async settle(id: string, targetId?: string) {
    const collection = await this.findOne(id);
    if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period');
    if (collection.settled) throw new BadRequestException('Collection has already been settled');
    const amount = Number(collection.amount), reference = collection.reference || `COL-${collection.id}`, description = `Field collection ${reference} — ${collection.type}`;
    if (!targetId) targetId = await this.resolveSettlementTarget(collection.customerId, collection.type);
    await this.staffWallet.ensureTables();
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe(`SELECT id FROM "DailyCollection" WHERE id=$1 FOR UPDATE`, id);
      const latest = await tx.dailyCollection.findUnique({ where: { id }, include: { period: true } });
      if (!latest) throw new NotFoundException('Daily collection not found');
      if (latest.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period');
      if (latest.settled) throw new BadRequestException('Collection has already been settled');
      await this.ensureAllocationTable(tx);
      let transactionId: string;
      let recordId: string | undefined;
      let allocation: any = null;
      if (collection.type === 'SAVINGS') {
        if (!targetId) throw new BadRequestException('A savings account is required to settle a savings collection');
        const savings = await tx.savings.findUnique({ where: { id: targetId } });
        if (!savings) throw new NotFoundException('Savings account not found');
        if (savings.customerId !== collection.customerId) throw new BadRequestException('Savings account does not belong to the collection customer');
        await tx.savings.update({ where: { id: savings.id }, data: { amount: { increment: amount } } });
        const transaction = await tx.transaction.create({ data: { customerId: collection.customerId, type: 'DEPOSIT', amount, description, periodId: collection.periodId } });
        transactionId = transaction.id;
      } else if (collection.type === 'LOAN_REPAYMENT') {
        if (!targetId) throw new BadRequestException('A loan is required to settle a loan repayment collection');
        const loan = await tx.loan.findUnique({ where: { id: targetId } });
        if (!loan) throw new NotFoundException('Loan not found');
        if (loan.customerId !== collection.customerId) throw new BadRequestException('Loan does not belong to the collection customer');
        const repayment = await tx.repayment.create({ data: { loanId: loan.id, amount, paymentDate: collection.collectionDate, method: 'FIELD_COLLECTION', notes: collection.notes || description, periodId: collection.periodId } });
        recordId = repayment.id;
        allocation = await this.allocateLoanRepayment(tx, loan.id, repayment.id, amount);
        const transaction = await tx.transaction.create({ data: { customerId: collection.customerId, type: 'LOAN_REPAYMENT', amount, description: `${description} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`, periodId: collection.periodId } });
        transactionId = transaction.id;
      } else {
        const transaction = await tx.transaction.create({ data: { customerId: collection.customerId, type: 'COLLECTION_OTHER', amount, description, periodId: collection.periodId } });
        transactionId = transaction.id;
      }
      await this.staffWallet.debit(collection.staffId, amount, reference, `Field collection settled — ${collection.type}`, tx);
      await tx.cashbookEntry.create({ data: { periodId: collection.periodId, branchId: collection.branchId, staffId: collection.staffId, type: 'CASH_IN', amount, reference, description, entryDate: collection.collectionDate } });
      return tx.dailyCollection.update({ where: { id }, data: { settled: true, settledAt: new Date(), settlementTransactionId: transactionId, settlementRecordId: recordId, reconciled: true }, include: { period: true, branch: true, staff: true, customer: true } });
    });
  }

  async summary(periodId?: string, branchId?: string, staffId?: string, branchIds?: string[] | null) {
    const collections = await this.findAll(periodId, branchId, staffId, undefined, branchIds);
    const summary: any = { total: 0, savings: 0, loanRepayments: 0, other: 0, reconciled: 0, unreconciled: 0, settled: 0, unsettled: 0, collectionCount: 0 };
    const officers = new Map<string, any>();
    for (const collection of collections as any[]) {
      const amount = Number(collection.amount || 0);
      summary.total += amount;
      if (collection.type === 'SAVINGS') summary.savings += amount;
      if (collection.type === 'LOAN_REPAYMENT') summary.loanRepayments += amount;
      if (collection.type === 'OTHER') summary.other += amount;
      if (collection.reconciled) summary.reconciled += amount; else summary.unreconciled += amount;
      if (collection.settled) summary.settled += amount; else summary.unsettled += amount;
      summary.collectionCount++;
      const staff = collection.staff || {};
      const key = String(collection.staffId || 'UNASSIGNED');
      const officer = officers.get(key) || {
        staffId: collection.staffId,
        employeeStaffId: staff.staffId || null,
        officerName: [staff.firstName, staff.lastName].filter(Boolean).join(' ').trim() || 'Unknown officer',
        branchId: collection.branchId,
        branchName: collection.branch?.name || null,
        collectionCount: 0,
        cashCollected: 0,
        settled: 0,
        unsettled: 0,
      };
      officer.collectionCount++;
      officer.cashCollected += amount;
      if (collection.settled) officer.settled += amount; else officer.unsettled += amount;
      officers.set(key, officer);
    }
    return { ...summary, byOfficer: [...officers.values()].sort((a, b) => b.cashCollected - a.cashCollected) };
  }

  async reconcile(id: string) { const collection = await this.findOne(id); if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period'); return this.prisma.dailyCollection.update({ where: { id }, data: { reconciled: true }, include: { period: true, branch: true, staff: true, customer: true } }); }
  async unreconcile(id: string) { const collection = await this.findOne(id); if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period'); if (collection.settled) throw new BadRequestException('A settled collection cannot be unreconciled'); return this.prisma.dailyCollection.update({ where: { id }, data: { reconciled: false } }); }
  async dailySummary(date: string, branchId?: string, staffId?: string, branchIds?: string[] | null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Invalid collection date');
    const start = new Date(`${date}T00:00:00.000+01:00`);
    const end = new Date(`${date}T23:59:59.999+01:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid collection date');

    const branchFilter = branchId ? { branchId } : branchIds ? { branchId: { in: branchIds } } : {};
    if (branchIds && !branchIds.length && !branchId) {
      return { date, total: 0, cashDeposits: 0, cashCollectedTotal: 0, savings: 0, loanRepayments: 0, other: 0, settled: 0, unsettled: 0, collectionCount: 0, depositCount: 0, byOfficer: [] };
    }

    const [collections, walletDeposits] = await Promise.all([
      this.prisma.dailyCollection.findMany({
        where: { collectionDate: { gte: start, lte: end }, ...branchFilter, ...(staffId ? { staffId } : {}) },
        include: {
          staff: { select: { id: true, staffId: true, firstName: true, lastName: true, branchId: true } },
          branch: { select: { id: true, name: true } },
        },
      }),
      this.prisma.walletTransaction.findMany({
        where: {
          type: 'DEPOSIT',
          status: 'COMPLETED',
          provider: 'MANUAL_CASH',
          createdAt: { gte: start, lte: end },
          ...branchFilter,
          ...(staffId ? { staffId } : {}),
        },
        select: { id: true, customerId: true, amount: true, reference: true, branchId: true, staffId: true, createdAt: true },
      }),
    ]);

    const collectionReferences = new Set((collections as any[]).map(row => String(row.reference || '').trim()).filter(Boolean));
    const deposits = (walletDeposits as any[]).filter(row => !row.reference || !collectionReferences.has(String(row.reference).trim()));
    const staffIds = [...new Set(deposits.map(row => String(row.staffId || '')).filter(Boolean))];
    const depositBranchIds = [...new Set(deposits.map(row => String(row.branchId || '')).filter(Boolean))];
    const [staffRows, branchRows] = await Promise.all([
      staffIds.length ? this.prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, staffId: true, firstName: true, lastName: true, branchId: true } }) : Promise.resolve([]),
      depositBranchIds.length ? this.prisma.branch.findMany({ where: { id: { in: depositBranchIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    ]);
    const staffById = new Map((staffRows as any[]).map(row => [String(row.id), row]));
    const branchById = new Map((branchRows as any[]).map(row => [String(row.id), row]));
    const summary: any = { date, total: 0, cashDeposits: 0, cashCollectedTotal: 0, savings: 0, loanRepayments: 0, other: 0, settled: 0, unsettled: 0, collectionCount: 0, depositCount: deposits.length };
    const officers = new Map<string, any>();

    const officerFor = (staffIdValue: string | null, branchIdValue: string | null, staff: any, branchName: string | null) => {
      const key = String(staffIdValue || 'UNASSIGNED');
      const officer = officers.get(key) || {
        staffId: staffIdValue,
        employeeStaffId: staff?.staffId || null,
        officerName: [staff?.firstName, staff?.lastName].filter(Boolean).join(' ').trim() || 'Unassigned collector',
        branchId: branchIdValue,
        branchName,
        collectionCount: 0,
        depositCount: 0,
        cashCollected: 0,
        settled: 0,
        unsettled: 0,
      };
      officers.set(key, officer);
      return officer;
    };

    for (const collection of collections as any[]) {
      const amount = Number(collection.amount || 0);
      summary.total += amount;
      if (collection.type === 'SAVINGS') summary.savings += amount;
      if (collection.type === 'LOAN_REPAYMENT') summary.loanRepayments += amount;
      if (collection.type === 'OTHER') summary.other += amount;
      if (collection.settled) summary.settled += amount; else summary.unsettled += amount;
      summary.collectionCount++;
      const officer = officerFor(collection.staffId || null, collection.branchId || null, collection.staff, collection.branch?.name || null);
      officer.collectionCount++;
      officer.cashCollected += amount;
      if (collection.settled) officer.settled += amount; else officer.unsettled += amount;
    }

    for (const deposit of deposits) {
      const amount = Number(deposit.amount || 0);
      summary.cashDeposits += amount;
      summary.settled += amount;
      const staff = deposit.staffId ? staffById.get(String(deposit.staffId)) : null;
      const branch = deposit.branchId ? branchById.get(String(deposit.branchId)) : null;
      const officer = officerFor(deposit.staffId || null, deposit.branchId || null, staff, branch?.name || null);
      officer.depositCount++;
      officer.cashCollected += amount;
      officer.settled += amount;
    }

    summary.cashCollectedTotal = summary.total + summary.cashDeposits;
    return { ...summary, byOfficer: [...officers.values()].sort((a, b) => b.cashCollected - a.cashCollected) };
  }
}
