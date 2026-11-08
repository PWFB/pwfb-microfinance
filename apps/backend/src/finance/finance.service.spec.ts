import { FinanceService } from './finance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      savings: {
        aggregate: jest.fn(),
      },
      loan: {
        aggregate: jest.fn(),
      },
      repayment: {
        aggregate: jest.fn(),
      },
      transaction: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    service = new FinanceService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return finance dashboard totals', async () => {
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
      _count: { id: 20 },
    } as any);

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 60000 },
      _count: { id: 10 },
    } as any);

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 25000 },
      _count: { id: 15 },
    } as any);

    prisma.transaction.count.mockResolvedValue(40);

    await expect(service.dashboard()).resolves.toEqual({
      totalSavings: 100000,
      totalLoans: 60000,
      totalRepayments: 25000,
      outstandingLoans: 35000,
      savingsAccounts: 20,
      loansCount: 10,
      repaymentsCount: 15,
      transactions: 40,
    });
  });

  it('should never return negative outstanding loans', async () => {
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
      _count: { id: 20 },
    } as any);

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 10000 },
      _count: { id: 5 },
    } as any);

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 15000 },
      _count: { id: 8 },
    } as any);

    prisma.transaction.count.mockResolvedValue(10);

    const result = await service.dashboard();

    expect(result.outstandingLoans).toBe(0);
  });

  it('should default dashboard aggregate totals to zero', async () => {
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    } as any);

    prisma.transaction.count.mockResolvedValue(0);

    await expect(service.dashboard()).resolves.toEqual({
      totalSavings: 0,
      totalLoans: 0,
      totalRepayments: 0,
      outstandingLoans: 0,
      savingsAccounts: 0,
      loansCount: 0,
      repaymentsCount: 0,
      transactions: 0,
    });
  });

  it('should return savings summary', async () => {
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 75000 },
      _count: { id: 12 },
    } as any);

    await expect(service.savingsSummary()).resolves.toEqual({
      total: 75000,
      accounts: 12,
    });
  });

  it('should return loans summary', async () => {
    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 50000 },
      _count: { id: 7 },
    } as any);

    await expect(service.loansSummary()).resolves.toEqual({
      total: 50000,
      loans: 7,
    });
  });

  it('should return repayments summary', async () => {
    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 20000 },
      _count: { id: 9 },
    } as any);

    await expect(service.repaymentsSummary()).resolves.toEqual({
      total: 20000,
      repayments: 9,
    });
  });

  it('should return recent transactions', async () => {
    const result = [
      { id: 'tx-1', amount: 5000 },
      { id: 'tx-2', amount: 2500 },
    ];

    prisma.transaction.findMany.mockResolvedValue(result as any);

    await expect(
      service.recentTransactions(),
    ).resolves.toBe(result);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });
  });
});
