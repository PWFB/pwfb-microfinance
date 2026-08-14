import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  async branchSummary(branchId: string, periodId?: string) {
    const period = periodId
      ? await this.prisma.financialPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.financialPeriod.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startDate: 'desc' },
        });

    const periodFilter = period ? { periodId: period.id } : {};

    const [collections, cashbook, payroll, savings, loans, repayments, staff] =
      await Promise.all([
        this.prisma.dailyCollection.aggregate({
          where: { branchId, ...periodFilter },
          _sum: { amount: true },
          _count: { id: true },
        }),

        this.prisma.cashbookEntry.groupBy({
          by: ['type'],
          where: { branchId, ...periodFilter },
          _sum: { amount: true },
          _count: { id: true },
        }),

        this.prisma.payroll.aggregate({
          where: {
            branchId,
            ...periodFilter,
          },
          _sum: {
            totalBasic: true,
            totalAllowances: true,
            totalDeductions: true,
            totalNet: true,
          },
        }),

        this.prisma.savings.aggregate({
          where: {
            periodId: period?.id,
            customer: {
              transactions: {
                some: {},
              },
            },
          },
          _sum: { amount: true },
        }),

        this.prisma.loan.aggregate({
          where: {
            periodId: period?.id,
          },
          _sum: { amount: true },
          _count: { id: true },
        }),

        this.prisma.repayment.aggregate({
          where: {
            periodId: period?.id,
          },
          _sum: { amount: true },
          _count: { id: true },
        }),

        this.prisma.staff.count({
          where: {
            branchId,
            employmentStatus: 'ACTIVE',
          },
        }),
      ]);

    const cashIn =
      cashbook.find((x) => x.type === 'CASH_IN')?._sum.amount ?? 0;

    const cashOut =
      cashbook.find((x) => x.type === 'CASH_OUT')?._sum.amount ?? 0;

    const collectionTotal = collections._sum.amount ?? 0;
    const payrollTotal = payroll._sum.totalNet ?? 0;

    return {
      dashboard: 'BRANCH_SUMMARY',
      branchId,
      period,
      staff: {
        active: staff,
      },
      savings: {
        total: savings._sum.amount ?? 0,
      },
      loans: {
        disbursed: loans._sum.amount ?? 0,
        count: loans._count.id,
      },
      repayments: {
        total: repayments._sum.amount ?? 0,
        count: repayments._count.id,
      },
      collections: {
        total: collectionTotal,
        count: collections._count.id,
      },
      cashbook: {
        cashIn,
        cashOut,
        net: cashIn - cashOut,
      },
      payroll: {
        basic: payroll._sum.totalBasic ?? 0,
        allowances: payroll._sum.totalAllowances ?? 0,
        deductions: payroll._sum.totalDeductions ?? 0,
        net: payrollTotal,
      },
      netCashPosition: cashIn - cashOut - payrollTotal,
    };
  }

  async coSummary(periodId?: string) {
    const period = periodId
      ? await this.prisma.financialPeriod.findUnique({
          where: { id: periodId },
        })
      : await this.prisma.financialPeriod.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startDate: 'desc' },
        });

    const periodFilter = period ? { periodId: period.id } : {};

    const [
      branches,
      staff,
      collections,
      cashbook,
      payroll,
      savings,
      loans,
      repayments,
    ] = await Promise.all([
      this.prisma.branch.findMany({
        orderBy: { name: 'asc' },
        include: {
          staff: {
            where: {
              employmentStatus: 'ACTIVE',
            },
            select: {
              id: true,
            },
          },
        },
      }),

      this.prisma.staff.count({
        where: {
          employmentStatus: 'ACTIVE',
        },
      }),

      this.prisma.dailyCollection.aggregate({
        where: periodFilter,
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.cashbookEntry.groupBy({
        by: ['type'],
        where: periodFilter,
        _sum: { amount: true },
      }),

      this.prisma.payroll.aggregate({
        where: periodFilter,
        _sum: {
          totalBasic: true,
          totalAllowances: true,
          totalDeductions: true,
          totalNet: true,
        },
      }),

      this.prisma.savings.aggregate({
        where: periodFilter,
        _sum: { amount: true },
      }),

      this.prisma.loan.aggregate({
        where: periodFilter,
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.repayment.aggregate({
        where: periodFilter,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const cashIn =
      cashbook.find((x) => x.type === 'CASH_IN')?._sum.amount ?? 0;

    const cashOut =
      cashbook.find((x) => x.type === 'CASH_OUT')?._sum.amount ?? 0;

    return {
      dashboard: 'CO_SUMMARY',
      period,
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        activeStaff: branch.staff.length,
      })),
      totals: {
        activeStaff: staff,
        savings: savings._sum.amount ?? 0,
        loansDisbursed: loans._sum.amount ?? 0,
        loanCount: loans._count.id,
        repayments: repayments._sum.amount ?? 0,
        repaymentCount: repayments._count.id,
        collections: collections._sum.amount ?? 0,
        collectionCount: collections._count.id,
        cashIn,
        cashOut,
        cashNet: cashIn - cashOut,
        payroll: payroll._sum.totalNet ?? 0,
        netCashPosition:
          cashIn - cashOut - (payroll._sum.totalNet ?? 0),
      },
    };
  }
}
