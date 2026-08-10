import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RiskComplianceService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async dashboard() {
    const [
      customers,
      loans,
      transactions,
      repayments,
      activeStaff,
      totalStaff,
    ] = await Promise.all([
      this.prisma.customer.count(),

      this.prisma.loan.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),

      this.prisma.transaction.count(),

      this.prisma.repayment.aggregate({
        _sum: { amount: true },
      }),

      this.prisma.staff.count({
        where: {
          employmentStatus: 'ACTIVE',
        },
      }),

      this.prisma.staff.count(),
    ]);

    const totalLoans = loans._sum.amount ?? 0;
    const totalRepayments = repayments._sum.amount ?? 0;

    return {
      customers,
      loans: loans._count.id,
      totalLoanExposure: totalLoans,
      totalRepayments,
      estimatedOutstandingExposure: Math.max(
        totalLoans - totalRepayments,
        0,
      ),
      transactions,
      activeStaff,
      totalStaff,
    };
  }

  async loanRisk() {
    const loans = await this.prisma.loan.findMany({
      select: {
        id: true,
        amount: true,
        status: true,
        customerId: true,
      },
      orderBy: {
        amount: 'desc',
      },
    });

    const statusCounts: Record<string, number> = {};
    let totalExposure = 0;

    for (const loan of loans) {
      const status = loan.status ?? 'UNKNOWN';

      statusCounts[status] =
        (statusCounts[status] ?? 0) + 1;

      totalExposure += loan.amount;
    }

    return {
      totalLoans: loans.length,
      totalExposure,
      statusCounts,
    };
  }

  async operationalChecks() {
    const [
      customers,
      users,
      staff,
      branches,
      departments,
      transactions,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.user.count(),
      this.prisma.staff.count(),
      this.prisma.branch.count(),
      this.prisma.department.count(),
      this.prisma.transaction.count(),
    ]);

    return {
      customers,
      users,
      staff,
      branches,
      departments,
      transactions,
      checks: {
        customerRecordsAvailable: customers > 0,
        usersConfigured: users > 0,
        staffConfigured: staff > 0,
        branchesConfigured: branches > 0,
        departmentsConfigured: departments > 0,
        transactionActivity: transactions > 0,
      },
    };
  }

  async staffRisk() {
    const [
      active,
      inactive,
    ] = await Promise.all([
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
}
