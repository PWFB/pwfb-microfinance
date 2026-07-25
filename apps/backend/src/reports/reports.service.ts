import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [
      totalCustomers,
      totalSavings,
      totalLoans,
      totalTransactions,
      totalRepayments,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.savings.count(),
      this.prisma.loan.count(),
      this.prisma.transaction.count(),
      this.prisma.repayment.count(),
    ]);

    return {
      totalCustomers,
      totalSavings,
      totalLoans,
      totalTransactions,
      totalRepayments,
    };
  }
}
