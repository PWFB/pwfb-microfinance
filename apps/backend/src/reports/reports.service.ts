import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [
      totalCustomers,
      savingsCount,
      savingsTotal,
      loansCount,
      loansTotal,
      transactionsCount,
      transactionsTotal,
      repaymentsCount,
      repaymentsTotal,
    ] = await Promise.all([
      this.prisma.customer.count(),

      this.prisma.savings.count(),
      this.prisma.savings.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.loan.count(),
      this.prisma.loan.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.repayment.count(),
      this.prisma.repayment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    const totalSavings = savingsTotal._sum.amount ?? 0;
    const totalLoans = loansTotal._sum.amount ?? 0;
    const totalTransactions = transactionsTotal._sum.amount ?? 0;
    const totalRepayments = repaymentsTotal._sum.amount ?? 0;

    return {
      customers: {
        count: totalCustomers,
      },

      savings: {
        count: savingsCount,
        amount: totalSavings,
      },

      loans: {
        count: loansCount,
        amount: totalLoans,
      },

      transactions: {
        count: transactionsCount,
        amount: totalTransactions,
      },

      repayments: {
        count: repaymentsCount,
        amount: totalRepayments,
      },

      portfolio: {
        amount: totalSavings + totalLoans,
      },
    };
  }
}
