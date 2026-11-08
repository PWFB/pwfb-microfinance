import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly scope: AccessScopeService) {}

  async summary(user: any, periodId?: string, branchId?: string) {
    const access = await this.scope.getScope(user);
    if (branchId) await this.scope.assertBranch(user, branchId);
    const branchIds = access.global ? null : await this.scope.getBranchIds(user);
    const effectiveBranchIds: string[] = branchId ? [branchId] : (branchIds || []);
    const hasRequestedBranch = Boolean(branchId);
    const hasBranchRestriction = !access.global || hasRequestedBranch;
    const emptyScope = hasBranchRestriction && effectiveBranchIds.length === 0;
    const branchFilter: any = !hasBranchRestriction ? {} : emptyScope ? { id: { in: [] } } : { branchId: { in: effectiveBranchIds } };
    const customerFilter: any = !hasBranchRestriction ? {} : emptyScope ? { id: { in: [] } } : { customer: { is: { branchId: { in: effectiveBranchIds } } } };
    const repaymentFilter: any = !hasBranchRestriction ? {} : emptyScope ? { id: { in: [] } } : { loan: { is: { customer: { is: { branchId: { in: effectiveBranchIds } } } } } };

    const [period, collections, cashbook, savings, loans, repayments, payroll]: any[] = await Promise.all([
      periodId ? this.prisma.financialPeriod.findUnique({ where: { id: periodId } }) : this.prisma.financialPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } }),
      this.prisma.dailyCollection.aggregate({ where: { ...(periodId ? { periodId } : {}), ...branchFilter }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.cashbookEntry.groupBy({ by: ['type'], where: { ...(periodId ? { periodId } : {}), ...branchFilter }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.savings.aggregate({ where: { ...(periodId ? { periodId } : {}), ...customerFilter }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.loan.aggregate({ where: { ...(periodId ? { periodId } : {}), ...customerFilter }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.repayment.aggregate({ where: { ...(periodId ? { periodId } : {}), ...repaymentFilter }, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.payroll.aggregate({ where: { ...(periodId ? { periodId } : {}), ...branchFilter, status: 'PAID' }, _sum: { totalNet: true }, _count: { id: true } }),
    ]);

    const settled: any = await this.prisma.dailyCollection.aggregate({ where: { ...(periodId ? { periodId } : {}), ...branchFilter, settled: true }, _sum: { amount: true }, _count: { id: true } });
    const reconciled: any = await this.prisma.dailyCollection.aggregate({ where: { ...(periodId ? { periodId } : {}), ...branchFilter, reconciled: true }, _sum: { amount: true }, _count: { id: true } });
    const unreconciled = await this.prisma.dailyCollection.findMany({
      where: { ...(periodId ? { periodId } : {}), ...branchFilter, reconciled: false },
      orderBy: { collectionDate: 'desc' }, take: 50,
      include: { staff: true, customer: true, branch: true },
    });

    const cashIn = Number(cashbook.find((x: any) => x.type === 'CASH_IN')?._sum?.amount || 0);
    const cashOut = Number(cashbook.find((x: any) => x.type === 'CASH_OUT')?._sum?.amount || 0);
    const collectionTotal = Number(collections._sum.amount || 0);
    const settledTotal = Number(settled._sum.amount || 0);
    const unreconciledAmount = collectionTotal - Number(reconciled._sum.amount || 0);

    let staffWallet = { wallets: 0, balance: 0 };
    if (access.global || !emptyScope) {
      try {
        const rows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int AS wallets, COALESCE(SUM(w.balance),0)::float AS balance FROM staff_wallets w ${hasBranchRestriction ? 'WHERE w.branch_id = ANY($1::text[])' : ''}`,
          ...(hasBranchRestriction ? [effectiveBranchIds] : []),
        );
        staffWallet = { wallets: Number(rows[0]?.wallets || 0), balance: Number(rows[0]?.balance || 0) };
      } catch (_) {}
    }

    let headOffice: { balance: number | null } = { balance: null };
    if (access.global) {
      try {
        const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT balance FROM head_office_accounts WHERE id='HEAD_OFFICE' LIMIT 1`);
        headOffice.balance = Number(rows[0]?.balance || 0);
      } catch (_) {}
    }

    return {
      period: period ? { id: period.id, name: period.name, status: period.status, startDate: period.startDate, endDate: period.endDate } : null,
      scope: { role: access.role, branchId: branchId || access.branchId || null, branchIds: effectiveBranchIds || null, global: access.global },
      controls: {
        collections: { count: collections._count?.id ?? 0, amount: collectionTotal, settledCount: settled._count?.id ?? 0, settledAmount: settledTotal, reconciledCount: reconciled._count?.id ?? 0, reconciledAmount: Number(reconciled._sum?.amount || 0), outstandingSettlement: collectionTotal - settledTotal, unreconciledAmount },
        cashbook: { cashIn, cashOut, balance: cashIn - cashOut, entries: cashbook.reduce((s: any, x: any) => s + Number(x._count.id || 0), 0) },
        savings: { records: savings._count?.id ?? 0, amount: Number(savings._sum?.amount || 0) },
        loans: { records: loans._count?.id ?? 0, amount: Number(loans._sum?.amount || 0) },
        repayments: { records: repayments._count?.id ?? 0, amount: Number(repayments._sum?.amount || 0) },
        payroll: { paidRuns: payroll._count?.id ?? 0, netPaid: Number(payroll._sum?.totalNet || 0) },
        staffWallet,
        headOffice,
      },
      exceptions: unreconciled.map((r: any) => ({ id: r.id, type: r.type, amount: Number(r.amount), reference: r.reference, date: r.collectionDate, settled: r.settled, reconciled: r.reconciled, branch: r.branch?.name, staff: [r.staff?.firstName, r.staff?.lastName].filter(Boolean).join(' '), customer: [r.customer?.firstName, r.customer?.lastName].filter(Boolean).join(' ') })),
      status: unreconciled.length === 0 ? 'CLEAR' : 'REVIEW_REQUIRED',
    };
  }
}
