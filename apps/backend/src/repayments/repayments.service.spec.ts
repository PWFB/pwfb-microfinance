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

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.transaction.create.mockResolvedValue({ id: 'tx-1' });
    service = new RepaymentsService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject repayment when loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(service.create({ loanId: 'missing', amount: 1000 } as any))
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
    } as any);

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

    await expect(service.create({ loanId: loan.id, amount: 2000 } as any))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transaction.create).not.toHaveBeenCalled();
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

    await service.update('repayment-1', { amount: 1500 } as any);

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

    await service.remove('repayment-1');

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
