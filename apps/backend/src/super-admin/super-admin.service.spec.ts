import { SuperAdminService } from './super-admin.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SuperAdminService', () => {
  let service: SuperAdminService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn() },
      customer: { count: jest.fn() },
      staff: { count: jest.fn() },
      branch: { count: jest.fn() },
      department: { count: jest.fn() },
      savings: { aggregate: jest.fn() },
      loan: { aggregate: jest.fn() },
      repayment: { aggregate: jest.fn() },
      transaction: { count: jest.fn() },
    };

    service = new SuperAdminService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return complete dashboard', async () => {
    prisma.user.count.mockResolvedValue(10);
    prisma.customer.count.mockResolvedValue(20);
    prisma.staff.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6);
    prisma.branch.count.mockResolvedValue(3);
    prisma.department.count.mockResolvedValue(5);
    prisma.transaction.count.mockResolvedValue(40);

    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 50000 },
    });

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
    });

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 40000 },
    });

    await expect(service.dashboard()).resolves.toEqual({
      system: {
        users: 10,
        customers: 20,
        staff: 8,
        activeStaff: 6,
        branches: 3,
        departments: 5,
        transactions: 40,
      },
      finance: {
        totalSavings: 50000,
        totalLoans: 100000,
        totalRepayments: 40000,
        outstandingLoans: 60000,
      },
    });
  });

  it('should return system stats', async () => {
    prisma.user.count.mockResolvedValue(10);
    prisma.customer.count.mockResolvedValue(20);
    prisma.staff.count.mockResolvedValue(8);
    prisma.branch.count.mockResolvedValue(3);
    prisma.department.count.mockResolvedValue(5);
    prisma.transaction.count.mockResolvedValue(40);

    await expect(service.systemStats()).resolves.toEqual({
      users: 10,
      customers: 20,
      staff: 8,
      branches: 3,
      departments: 5,
      transactions: 40,
    });
  });

  it('should return financial stats', async () => {
    prisma.savings.aggregate.mockResolvedValue({
      _sum: { amount: 50000 },
    });

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
    });

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 40000 },
    });

    await expect(service.financialStats()).resolves.toEqual({
      totalSavings: 50000,
      totalLoans: 100000,
      totalRepayments: 40000,
      outstandingLoans: 60000,
    });
  });

  it('should return staff stats', async () => {
    prisma.staff.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3);

    await expect(service.staffStats()).resolves.toEqual({
      total: 10,
      active: 7,
      inactive: 3,
    });
  });
});
