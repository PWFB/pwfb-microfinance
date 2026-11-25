import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService organization scoping', () => {
  it('uses every authorized branch for collections, cashbook, savings, loans, repayments and payroll', async () => {
    const prisma: any = {
      financialPeriod: {
        findUnique: jest.fn().mockResolvedValue({ id: 'period-1', name: 'November', status: 'OPEN', startDate: new Date(), endDate: new Date() }),
      },
      dailyCollection: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cashbookEntry: { groupBy: jest.fn().mockResolvedValue([]) },
      savings: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      loan: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      repayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      payroll: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalNet: 0 }, _count: { id: 0 } }) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ wallets: 2, balance: 0 }]),
    };
    const scope: any = {
      getScope: jest.fn().mockResolvedValue({ role: 'AREA_MANAGER', branchId: 'branch-home', global: false }),
      getScopedBranchIds: jest.fn().mockResolvedValue(['branch-home', 'branch-east', 'branch-west']),
      assertBranch: jest.fn(),
    };
    const service = new ReconciliationService(prisma, scope);

    const result = await service.summary({ id: 'area-user', role: 'AREA_MANAGER' }, 'period-1');

    const branchFilter = { in: ['branch-home', 'branch-east', 'branch-west'] };
    expect(prisma.dailyCollection.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', branchId: branchFilter },
    }));
    expect(prisma.cashbookEntry.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', branchId: branchFilter },
    }));
    expect(prisma.savings.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: branchFilter } },
    }));
    expect(prisma.loan.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', customer: { branchId: branchFilter } },
    }));
    expect(prisma.repayment.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', loan: { customer: { branchId: branchFilter } } },
    }));
    expect(prisma.payroll.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodId: 'period-1', branchId: branchFilter, status: 'PAID' },
    }));
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('WHERE w.branch_id = ANY($1::text[])'), ['branch-home', 'branch-east', 'branch-west']);
    expect(result.controls.headOffice).toEqual({ balance: null, restricted: true });
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalledWith(expect.stringContaining('head_office_accounts'));
  });

  it('does not allow a branch user to request a branch outside their assignment', async () => {
    const prisma: any = {};
    const scope: any = {
      getScope: jest.fn().mockResolvedValue({ role: 'BRANCH_MANAGER', branchId: 'branch-a', global: false }),
      getScopedBranchIds: jest.fn().mockResolvedValue(['branch-a']),
      assertBranch: jest.fn().mockRejectedValue(new Error('outside scope')),
    };
    const service = new ReconciliationService(prisma, scope);

    await expect(service.summary({ id: 'manager', role: 'BRANCH_MANAGER' }, 'period-1', 'branch-b'))
      .rejects.toThrow('outside scope');
  });

  it('only exposes head-office balance in Super Admin global view', async () => {
    const prisma: any = {
      financialPeriod: { findUnique: jest.fn().mockResolvedValue(null) },
      dailyCollection: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      cashbookEntry: { groupBy: jest.fn().mockResolvedValue([]) },
      savings: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      loan: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      repayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: { id: 0 } }) },
      payroll: { aggregate: jest.fn().mockResolvedValue({ _sum: { totalNet: 0 }, _count: { id: 0 } }) },
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([{ wallets: 10, balance: 0 }])
        .mockResolvedValueOnce([{ balance: 150000 }]),
    };
    const scope: any = {
      getScope: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN', branchId: null, global: true }),
      getScopedBranchIds: jest.fn().mockResolvedValue(null),
      assertBranch: jest.fn(),
    };
    const service = new ReconciliationService(prisma, scope);

    const result = await service.summary({ id: 'root', role: 'SUPER_ADMIN' }, 'period-1');

    expect(result.controls.headOffice).toEqual({ balance: 150000 });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('head_office_accounts'));
  });
});
