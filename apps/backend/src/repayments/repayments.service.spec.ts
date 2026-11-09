import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsService', () => {
  let service: RepaymentsService;

  const prisma = {
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    $transaction: jest.fn(),
    loan: { findUnique: jest.fn() },
    repayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    transaction: { create: jest.fn() },
  } as any;

  const tx = prisma;
  const accessScope = {
    assertLoan: jest.fn().mockResolvedValue(true),
    getScope: jest.fn().mockResolvedValue({ global: true, role: 'SUPER_ADMIN' }),
    getScopedBranchIds: jest.fn().mockResolvedValue(null),
  } as any;
  const user = { id: 'admin-user', role: 'SUPER_ADMIN' };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });
    service = new RepaymentsService(prisma, accessScope);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject repayment when loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(service.create({ loanId: 'missing', amount: 1000 } as any, user))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });

  it('should allocate repayment interest first, then principal, and expose outstanding balances', async () => {
    const loan = {
      id: 'loan-1',
      amount: 10000,
      interestRate: 10,
      customerId: 'customer-1',
    };
    const repayment = { id: 'repayment-1', loanId: loan.id, amount: 3000 };

    prisma.loan.findUnique
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan);
    prisma.repayment.create.mockResolvedValue(repayment);
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ interestAmount: 1000 }])
      .mockResolvedValueOnce([{ interestPaid: 0, principalPaid: 0 }]);

    const result = await service.create({
      loanId: loan.id,
      amount: 3000,
      method: 'CASH',
    } as any, user);

    expect(result.interestPaid).toBe(1000);
    expect(result.principalPaid).toBe(2000);
    expect(result.interestOutstanding).toBe(0);
    expect(result.principalOutstanding).toBe(8000);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'LOAN_REPAYMENT',
        amount: 3000,
      }),
    }));
  });

  it('should reject a repayment above the outstanding loan balance', async () => {
    const loan = {
      id: 'loan-1',
      amount: 1000,
      interestRate: 10,
      customerId: 'customer-1',
    };

    prisma.loan.findUnique
      .mockResolvedValueOnce(loan)
      .mockResolvedValueOnce(loan);
    prisma.repayment.create.mockResolvedValue({
      id: 'repayment-over',
      loanId: loan.id,
      amount: 2000,
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ interestAmount: 100 }])
      .mockResolvedValueOnce([{ interestPaid: 0, principalPaid: 0 }]);

    await expect(service.create({ loanId: loan.id, amount: 2000 } as any, user))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('filters repayment history to the Credit Officer assigned branch and customers', async () => {
    accessScope.getScope.mockResolvedValue({ global: false, role: 'CREDIT_OFFICER', staffId: 'staff-1' });
    accessScope.getScopedBranchIds.mockResolvedValue(['branch-1']);
    prisma.repayment.findMany.mockResolvedValue([]);

    await service.findAll({ id: 'officer-user', role: 'CREDIT_OFFICER', staffId: 'staff-1' });

    expect(prisma.repayment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        loan: {
          customer: {
            branchId: { in: ['branch-1'] },
            assignedStaffId: 'staff-1',
          },
        },
      },
    }));
  });

  it('checks loan ownership before returning an individual repayment', async () => {
    prisma.repayment.findUnique.mockResolvedValue({
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 500,
      loan: { customer: { id: 'customer-1' } },
    });
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{ principalPaid: 400, interestPaid: 100 }]);

    const result = await service.findOne('repayment-1', user);

    expect(accessScope.assertLoan).toHaveBeenCalledWith(user, 'loan-1');
    expect(result).toMatchObject({ id: 'repayment-1', principalPaid: 400, interestPaid: 100 });
  });

  it('should create an adjustment ledger entry when repayment amount increases', async () => {
    const existing = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 1000,
      interestPaid: 100,
      principalPaid: 900,
      loan: { customerId: 'customer-1' },
    };

    jest.spyOn(service, 'findOne').mockResolvedValue(existing as any);
    prisma.repayment.update.mockResolvedValue({ ...existing, amount: 1500 });
    prisma.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      amount: 10000,
      interestRate: 10,
      customerId: 'customer-1',
    });
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([{ interestAmount: 1000 }])
      .mockResolvedValueOnce([{ interestPaid: 0, principalPaid: 0 }]);

    await service.update('repayment-1', { amount: 1500 } as any, user);

    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'LOAN_REPAYMENT_ADJUSTMENT',
        amount: 500,
      }),
    }));
  });

  it('should create a reversal ledger entry when a repayment is deleted', async () => {
    const existing = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 1000,
      interestPaid: 100,
      principalPaid: 900,
      loan: { customerId: 'customer-1' },
    };

    jest.spyOn(service, 'findOne').mockResolvedValue(existing as any);
    prisma.repayment.delete.mockResolvedValue(existing);

    await service.remove('repayment-1', user);

    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'LOAN_REPAYMENT_REVERSAL',
        amount: 1000,
      }),
    }));
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM "PWFBRepaymentAllocation"'),
      'repayment-1',
    );
  });
});
