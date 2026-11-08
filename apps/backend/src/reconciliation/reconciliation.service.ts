import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly scope: AccessScopeService) {}

  async summary(user: any, periodId?: string, branchId?: string) {
    const access = await this.scope.getScope(user);
    if (branchId) await this.scope.assertBranch(user, branchId);
    const effectiveBranch = branchId || (access.global ? undefined : access.branchId || undefined);
    const where: any = { ...(periodId ? { periodId } : {}), ...(effectiveBranch ? { branchId: effectiveBranch } : {}) };

    const [period, collections, cashbook, savings, loans, repayments, payroll] = await Promise.all([
      periodId ? this.prisma.financialPeriod.findUnique({ where: { id: periodId } }) : this.prisma.financialPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } }),
      this.prisma.dailyCollection.aggregate({ where, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.cashbookEntry.groupBy({ by: ['type'], where, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.savings.aggregate({ where: periodId ? { periodId } : {}, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.loan.aggregate({ where: periodId ? { periodId } : {}, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.repayment.aggregate({ where: periodId ? { periodId } : {}, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.payroll.aggregate({ where: { ...(periodId ? { periodId } : {}), ...(effectiveBranch ? { branchId: effectiveBranch } : {}), status: 'PAID' }, _sum: { totalNet: true }, _count: { id: true } }),
    ]);

    const settled = await this.prisma.dailyCollection.aggregate({ where: { ...where, settled: true }, _sum: { amount: true }, _count: { id: true } });
    const reconciled = await this.prisma.dailyCollection.aggregate({ where: { ...where, reconciled: true }, _sum: { amount: true }, _count: { id: true } });
    const unreconciled = await this.prisma.dailyCollection.findMany({ where: { ...where, reconciled: false }, orderBy: { collectionDate: 'desc' }, take: 50, include: { staff: true, customer: true, branch: true } });

    const cashIn = Number(cashbook.find((x:any) => x.type === 'CASH_IN')?._sum?.amount || 0);
    const cashOut = Number(cashbook.find((x:any) => x.type === 'CASH_OUT')?._sum?.amount || 0);
    const collectionTotal = Number(collections._sum.amount || 0);
    const settledTotal = Number(settled._sum.amount || 0);
    const unreconciledAmount = collectionTotal - Number(reconciled._sum.amount || 0);

    let staffWallet = { wallets: 0, balance: 0 };
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS wallets, COALESCE(SUM(w.balance),0)::float AS balance FROM staff_wallets w ${effectiveBranch ? 'WHERE w.branch_id=$1' : ''}`, ...(effectiveBranch ? [effectiveBranch] : []));
      staffWallet = { wallets: Number(rows[0]?.wallets || 0), balance: Number(rows[0]?.balance || 0) };
    } catch (_) {}

    let headOffice = { balance: 0 };
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT balance FROM head_office_accounts WHERE id='HEAD_OFFICE' LIMIT 1`);
      headOffice.balance = Number(rows[0]?.balance || 0);
    } catch (_) {}

    return {
      period: period ? { id: period.id, name: period.name, status: period.status, startDate: period.startDate, endDate: period.endDate } : null,
      scope: { role: access.role, branchId: effectiveBranch || null, global: access.global },
      controls: {
        collections: { count: collections._count.id, amount: collectionTotal, settledCount: settled._count.id, settledAmount: settledTotal, reconciledCount: reconciled._count.id, reconciledAmount: Number(reconciled._sum.amount || 0), outstandingSettlement: collectionTotal - settledTotal, unreconciledAmount },
        cashbook: { cashIn, cashOut, balance: cashIn - cashOut, entries: cashbook.reduce((s:any,x:any)=>s+Number(x._count.id||0),0) },
        savings: { records: savings._count.id, amount: Number(savings._sum.amount || 0) },
        loans: { records: loans._count.id, amount: Number(loans._sum.amount || 0) },
        repayments: { records: repayments._count.id, amount: Number(repayments._sum.amount || 0) },
        payroll: { paidRuns: payroll._count.id, netPaid: Number(payroll._sum.totalNet || 0) },
        staffWallet,
        headOffice,
      },
      exceptions: unreconciled.map((r:any) => ({ id: r.id, type: r.type, amount: Number(r.amount), reference: r.reference, date: r.collectionDate, settled: r.settled, reconciled: r.reconciled, branch: r.branch?.name, staff: [r.staff?.firstName, r.staff?.lastName].filter(Boolean).join(' '), customer: [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(' ') })),
      status: unreconciled.length === 0 ? 'CLEAR' : 'REVIEW_REQUIRED',
    };
  }
}
