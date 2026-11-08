import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async dashboard() {
    const [
      customers,
      savings,
      loans,
      repayments,
      transactions,
      staff,
      departments,
      branches,
    ] = await Promise.all([
      this.prisma.customer.count(),

      this.prisma.savings.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.loan.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.repayment.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.transaction.count(),

      this.prisma.staff.count(),

      this.prisma.department.count(),

      this.prisma.branch.count(),
    ]);

    return {
      customers,
      totalSavings: savings._sum.amount ?? 0,
      totalLoans: loans._sum.amount ?? 0,
      totalRepayments: repayments._sum.amount ?? 0,
      transactions,
      staff,
      departments,
      branches,
    };
  }

  async staffStatus() {
    const [active, inactive] =
      await Promise.all([
        this.prisma.staff.count({
          where: {
            employmentStatus: 'ACTIVE',
          },
        }),

        this.prisma.staff.count({
          where: {
            employmentStatus: {
              not: 'ACTIVE',
            },
          },
        }),
      ]);

    return {
      active,
      inactive,
      total: active + inactive,
    };
  }

  async loanStatuses() {
    const loans = await this.prisma.loan.findMany({
      select: {
        status: true,
      },
    });

    const statusCounts: Record<string, number> = {};

    for (const loan of loans) {
      const status = loan.status ?? 'UNKNOWN';

      statusCounts[status] =
        (statusCounts[status] ?? 0) + 1;
    }

    return statusCounts;
  }

  async recentTransactions() {
    return this.prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });
  }

  async departments() {
    return this.prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  }

  async branches() {
    return this.prisma.branch.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  }
}
