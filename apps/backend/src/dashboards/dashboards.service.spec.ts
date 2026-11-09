import { DashboardsService } from './dashboards.service';

describe('DashboardsService branch scope', () => {
  const prisma: any = {
    financialPeriod: { findUnique: jest.fn(), findFirst: jest.fn() },
    dailyCollection: { aggregate: jest.fn() },
    cashbookEntry: { groupBy: jest.fn() },
    payroll: { aggregate: jest.fn() },
    savings: { aggregate: jest.fn() },
    loan: { aggregate: jest.fn() },
    repayment: { aggregate: jest.fn() },
    staff: { count: jest.fn() },
    branch: { findMany: jest.fn() },
  };
  let service: DashboardsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.financialPeriod.findFirst.mockResolvedValue({ id: 'period-1', name: 'November', status: 'OPEN' });
    prisma.dailyCollection.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } });
    prisma.cashbookEntry.groupBy.mockResolvedValue([]);
    prisma.payroll.aggregate.mockResolvedValue({ _sum: { totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNet: 0 } });
    prisma.savings.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    prisma.loan.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } });
    prisma.repayment.aggregate.mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } });
    prisma.staff.count.mockResolvedValue(0);
    service = new DashboardsService(prisma);
  });

  it('is defined', () => expect(service).toBeDefined());

  it('filters every financial branch aggregate by the selected branch', async () => {
    await service.branchSummary('branch-1');

    expect(prisma.dailyCollection.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: 'branch-1', periodId: 'period-1' },
    }));
    expect(prisma.cashbookEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: 'branch-1', periodId: 'period-1' },
    }));
    expect(prisma.payroll.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: 'branch-1', periodId: 'period-1' },
    }));
    expect(prisma.savings.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: 'branch-1' } },
    }));
    expect(prisma.loan.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: 'branch-1' } },
    }));
    expect(prisma.repayment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', loan: { customer: { branchId: 'branch-1' } } },
    }));
    expect(prisma.staff.count).toHaveBeenCalledWith({
      where: { branchId: 'branch-1', employmentStatus: 'ACTIVE' },
    });
  });
});
