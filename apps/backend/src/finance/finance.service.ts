import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async dashboard() {
    const [
      savings,
      loans,
      repayments,
      transactions,
    ] = await Promise.all([
      this.prisma.savings.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.loan.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.repayment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.transaction.count(),
    ]);

    const totalSavings =
      savings._sum.amount ?? 0;

    const totalLoans =
      loans._sum.amount ?? 0;

    const totalRepayments =
      repayments._sum.amount ?? 0;

    return {
      totalSavings,
      totalLoans,
      totalRepayments,
      outstandingLoans: Math.max(
        totalLoans - totalRepayments,
        0,
      ),
      savingsAccounts: savings._count.id,
      loansCount: loans._count.id,
      repaymentsCount: repayments._count.id,
      transactions,
    };
  }

  async savingsSummary() {
    const result =
      await this.prisma.savings.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      });

    return {
      total: result._sum.amount ?? 0,
      accounts: result._count.id,
    };
  }

  async loansSummary() {
    const result =
      await this.prisma.loan.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      });

    return {
      total: result._sum.amount ?? 0,
      loans: result._count.id,
    };
  }

  async repaymentsSummary() {
    const result =
      await this.prisma.repayment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      });

    return {
      total: result._sum.amount ?? 0,
      repayments: result._count.id,
    };
  }

  async recentTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });
  }
}
