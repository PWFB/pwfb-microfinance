import { MonitoringService } from './monitoring.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn() },
      savings: { aggregate: jest.fn() },
      loan: { aggregate: jest.fn(), findMany: jest.fn() },
      repayment: { aggregate: jest.fn() },
      transaction: { count: jest.fn(), findMany: jest.fn() },
      staff: { count: jest.fn() },
      department: { count: jest.fn(), findMany: jest.fn() },
      branch: { count: jest.fn(), findMany: jest.fn() },
    };

    service = new MonitoringService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return dashboard statistics', async () => {
    prisma.customer.count.mockResolvedValue(10);
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 50000 },
    });
    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
    });
    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 40000 },
    });
    prisma.transaction.count.mockResolvedValue(25);
    prisma.staff.count.mockResolvedValue(8);
    prisma.department.count.mockResolvedValue(3);
    prisma.branch.count.mockResolvedValue(2);

    await expect(service.dashboard()).resolves.toEqual({
      customers: 10,
      totalSavings: 50000,
      totalLoans: 100000,
      totalRepayments: 40000,
      transactions: 25,
      staff: 8,
      departments: 3,
      branches: 2,
    });
  });

  it('should return staff status', async () => {
    prisma.staff.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    await expect(service.staffStatus()).resolves.toEqual({
      active: 6,
      inactive: 2,
      total: 8,
    });
  });

  it('should return loan status counts', async () => {
    prisma.loan.findMany.mockResolvedValue([
      { status: 'PENDING' },
      { status: 'PENDING' },
      { status: 'APPROVED' },
      { status: null },
    ]);

    await expect(service.loanStatuses()).resolves.toEqual({
      PENDING: 2,
      APPROVED: 1,
      UNKNOWN: 1,
    });
  });

  it('should return recent transactions', async () => {
    const result = [{ id: 'tx-1' }];
    prisma.transaction.findMany.mockResolvedValue(result);

    await expect(service.recentTransactions()).resolves.toBe(result);
  });

  it('should return departments', async () => {
    const result = [{ id: 'dept-1' }];
    prisma.department.findMany.mockResolvedValue(result);

    await expect(service.departments()).resolves.toBe(result);
  });

  it('should return branches', async () => {
    const result = [{ id: 'branch-1' }];
    prisma.branch.findMany.mockResolvedValue(result);

    await expect(service.branches()).resolves.toBe(result);
  });
});
