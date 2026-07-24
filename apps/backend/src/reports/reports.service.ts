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
        _sum: {
          amount: true,
        },
      }),

      this.prisma.loan.aggregate({
        _sum: {
          amount: true,
        },
      }),

      this.prisma.transaction.aggregate({
        _sum: {
          amount: true,
        },
      }),

      this.prisma.repayment.aggregate({
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      totalCustomers,
      totalSavings: totalSavings._sum.amount ?? 0,
      totalLoans: totalLoans._sum.amount ?? 0,
      totalTransactions: totalTransactions._sum.amount ?? 0,
      totalRepayments: totalRepayments._sum.amount ?? 0,
    };
  }


  customers() {
    return this.prisma.customer.findMany();
  }


  savings() {
    return this.prisma.savings.findMany({
      include: {
        customer: true,
      },
    });
  }


  loans() {
    return this.prisma.loan.findMany({
      include: {
        customer: true,
      },
    });
  }


  transactions() {
    return this.prisma.transaction.findMany({
      include: {
        customer: true,
      },
    });
  }


  repayments() {
    return this.prisma.repayment.findMany({
      include: {
        loan: true,
      },
    });
  }


  async monthlySummary() {
    const savings = await this.prisma.savings.findMany({
      select: {
        amount: true,
        createdAt: true,
      },
    });


    const loans = await this.prisma.loan.findMany({
      select: {
        amount: true,
        createdAt: true,
      },
    });


    const repayments = await this.prisma.repayment.findMany({
      select: {
        amount: true,
        createdAt: true,
      },
    });


    const groupByMonth = (items: any[]) => {
      return items.reduce((result, item) => {
        const month = new Date(item.createdAt)
          .toLocaleString('default', {
            month: 'short',
          });


        result[month] =
          (result[month] || 0) + item.amount;


        return result;
      }, {});
    };


    return {
      savings: groupByMonth(savings),
      loans: groupByMonth(loans),
      repayments: groupByMonth(repayments),
    };
  }
}
