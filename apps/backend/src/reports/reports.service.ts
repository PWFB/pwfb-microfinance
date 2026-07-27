import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [
      totalCustomers,
      totalSavings,
      totalLoans,
      totalTransactions,
      totalRepayments,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.savings.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.loan.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.transaction.count(),
      this.prisma.repayment.aggregate({
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCustomers,
      totalSavings: totalSavings._sum.amount ?? 0,
      totalLoans: totalLoans._sum.amount ?? 0,
      totalTransactions,
      totalRepayments: totalRepayments._sum.amount ?? 0,
    };
  }
}
