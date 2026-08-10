import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async dashboard() {
    const [
      users,
      customers,
      staff,
      activeStaff,
      branches,
      departments,
      savings,
      loans,
      repayments,
      transactions,
    ] = await Promise.all([
      this.prisma.user.count(),

      this.prisma.customer.count(),

      this.prisma.staff.count(),

      this.prisma.staff.count({
        where: {
          employmentStatus: 'ACTIVE',
        },
      }),

      this.prisma.branch.count(),

      this.prisma.department.count(),

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

      this.prisma.repayment.aggregate({
        _sum: {
          amount: true,
        },
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
      system: {
        users,
        customers,
        staff,
        activeStaff,
        branches,
        departments,
        transactions,
      },

      finance: {
        totalSavings,
        totalLoans,
        totalRepayments,
        outstandingLoans: Math.max(
          totalLoans - totalRepayments,
          0,
        ),
      },
    };
  }

  async systemStats() {
    const [
      users,
      customers,
      staff,
      branches,
      departments,
      transactions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.customer.count(),
      this.prisma.staff.count(),
      this.prisma.branch.count(),
      this.prisma.department.count(),
      this.prisma.transaction.count(),
    ]);

    return {
      users,
      customers,
      staff,
      branches,
      departments,
      transactions,
    };
  }

  async financialStats() {
    const [
      savings,
      loans,
      repayments,
    ] = await Promise.all([
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

      this.prisma.repayment.aggregate({
        _sum: {
          amount: true,
        },
      }),
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
    };
  }

  async staffStats() {
    const [
      total,
      active,
      inactive,
    ] = await Promise.all([
      this.prisma.staff.count(),

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
      total,
      active,
      inactive,
    };
  }
}
