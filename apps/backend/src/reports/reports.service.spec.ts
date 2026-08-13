import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn() },
      savings: { count: jest.fn(), aggregate: jest.fn() },
      loan: { count: jest.fn(), aggregate: jest.fn() },
      transaction: { count: jest.fn(), aggregate: jest.fn() },
      repayment: { count: jest.fn(), aggregate: jest.fn() },
    };

    service = new ReportsService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return complete report summary', async () => {
    prisma.customer.count.mockResolvedValue(10);

    prisma.savings.count.mockResolvedValue(5);
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 50000 },
    });

    prisma.loan.count.mockResolvedValue(4);
    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
    });

    prisma.transaction.count.mockResolvedValue(20);
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: 75000 },
    });

    prisma.repayment.count.mockResolvedValue(3);
    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 40000 },
    });

    await expect(service.getSummary()).resolves.toEqual({
      customers: { count: 10 },
      savings: { count: 5, amount: 50000 },
      loans: { count: 4, amount: 100000 },
      transactions: { count: 20, amount: 75000 },
      repayments: { count: 3, amount: 40000 },
      portfolio: { amount: 150000 },
    });
  });

  it('should use zero when aggregate amounts are null', async () => {
    prisma.customer.count.mockResolvedValue(0);
    prisma.savings.count.mockResolvedValue(0);
    prisma.loan.count.mockResolvedValue(0);
    prisma.transaction.count.mockResolvedValue(0);
    prisma.repayment.count.mockResolvedValue(0);

    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    await expect(service.getSummary()).resolves.toEqual({
      customers: { count: 0 },
      savings: { count: 0, amount: 0 },
      loans: { count: 0, amount: 0 },
      transactions: { count: 0, amount: 0 },
      repayments: { count: 0, amount: 0 },
      portfolio: { amount: 0 },
    });
  });
});
