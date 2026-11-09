import { DashboardsService } from './dashboards.service';

describe('DashboardsService branch summaries', () => {
  it('filters savings, loans and repayments by the requested branch', async () => {
    const prisma: any = {
      financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1', name: 'November' }) },
      dailyCollection: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      cashbookEntry: { groupBy: jest.fn().mockResolvedValue([]) },
      payroll: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNet: 0 } }) },
      savings: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      loan: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      repayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      staff: { count: jest.fn().mockResolvedValue(0) },
    };
    const service = new DashboardsService(prisma);

    await service.branchSummary('branch-north');

    expect(prisma.savings.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: 'branch-north' } },
    }));
    expect(prisma.loan.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: 'branch-north' } },
    }));
    expect(prisma.repayment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', loan: { customer: { branchId: 'branch-north' } } },
    }));
  });
});
