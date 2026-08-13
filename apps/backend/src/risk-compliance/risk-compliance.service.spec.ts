import { RiskComplianceService } from './risk-compliance.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RiskComplianceService', () => {
  let service: RiskComplianceService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn() },
      loan: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
      transaction: { count: jest.fn() },
      repayment: { aggregate: jest.fn() },
      staff: { count: jest.fn() },
      user: { count: jest.fn() },
      branch: { count: jest.fn() },
      department: { count: jest.fn() },
    };

    service = new RiskComplianceService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return risk dashboard', async () => {
    prisma.customer.count.mockResolvedValue(20);

    prisma.loan.aggregate.mockResolvedValue({
      _sum: { amount: 100000 },
      _count: { id: 5 },
    });

    prisma.transaction.count.mockResolvedValue(30);

    prisma.repayment.aggregate.mockResolvedValue({
      _sum: { amount: 40000 },
    });

    prisma.staff.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(10);

    await expect(service.dashboard()).resolves.toEqual({
      customers: 20,
      loans: 5,
      totalLoanExposure: 100000,
      totalRepayments: 40000,
      estimatedOutstandingExposure: 60000,
      transactions: 30,
      activeStaff: 8,
      totalStaff: 10,
    });
  });

  it('should return loan risk summary', async () => {
    prisma.loan.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        amount: 50000,
        status: 'PENDING',
        customerId: 'customer-1',
      },
      {
        id: 'loan-2',
        amount: 25000,
        status: 'APPROVED',
        customerId: 'customer-2',
      },
      {
        id: 'loan-3',
        amount: 10000,
        status: null,
        customerId: 'customer-3',
      },
    ]);

    await expect(service.loanRisk()).resolves.toEqual({
      totalLoans: 3,
      totalExposure: 85000,
      statusCounts: {
        PENDING: 1,
        APPROVED: 1,
        UNKNOWN: 1,
      },
    });
  });

  it('should return operational checks', async () => {
    prisma.customer.count.mockResolvedValue(1);
    prisma.user.count.mockResolvedValue(1);
    prisma.staff.count.mockResolvedValue(1);
    prisma.branch.count.mockResolvedValue(1);
    prisma.department.count.mockResolvedValue(1);
    prisma.transaction.count.mockResolvedValue(1);

    await expect(service.operationalChecks()).resolves.toEqual({
      customers: 1,
      users: 1,
      staff: 1,
      branches: 1,
      departments: 1,
      transactions: 1,
      checks: {
        customerRecordsAvailable: true,
        usersConfigured: true,
        staffConfigured: true,
        branchesConfigured: true,
        departmentsConfigured: true,
        transactionActivity: true,
      },
    });
  });

  it('should return staff risk', async () => {
    prisma.staff.count
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);

    await expect(service.staffRisk()).resolves.toEqual({
      active: 6,
      inactive: 2,
      total: 8,
    });
  });
});
