import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsService', () => {
  let service: RepaymentsService;
  let prisma: any;
  let accessScope: any;

  const loan = {
    id: 'loan-1',
    amount: 10000,
    interestRate: 10,
    customerId: 'customer-1',
    customer: { id: 'customer-1', branchId: 'branch-1', assignedStaffId: 'staff-1' },
  };
  const user = { id: 'user-1', role: 'CREDIT_OFFICER', staffId: 'staff-1' };
  const staff = { id: 'staff-1', staffId: 'ST-001', branchId: 'branch-1', employmentStatus: 'ACTIVE' };

  beforeEach(() => {
    prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn(async (sql: string) => {
        if (String(sql).includes('interestAmount')) return [{ interestAmount: 1000 }];
        if (String(sql).includes('SUM("interestPaid")')) return [{ interestPaid: 0, principalPaid: 0 }];
        return [];
      }),
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      loan: { findUnique: jest.fn().mockResolvedValue(loan) },
      staff: { findUnique: jest.fn().mockResolvedValue(staff) },
      financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1', status: 'OPEN', startDate: new Date('2020-01-01'), endDate: new Date('2035-12-31') }) },
      repayment: {
        create: jest.fn(async ({ data }: any) => ({ id: 'repayment-1', ...data })),
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      cashbookEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'cashbook-1', ...data })),
      },
      transaction: { create: jest.fn(async ({ data }: any) => ({ id: 'ledger-1', ...data })) },
    };
    accessScope = {
      getScope: jest.fn().mockResolvedValue({ role: 'CREDIT_OFFICER', staffId: 'staff-1', branchId: 'branch-1', global: false }),
      getBranchIds: jest.fn().mockResolvedValue(['branch-1']),
      assertLoan: jest.fn().mockResolvedValue(true),
    };
    service = new RepaymentsService(prisma, accessScope);
  });

  it('rejects a repayment when the loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);
    await expect(service.create({
      loanId: 'missing', amount: 1000, method: 'CASH',
      cashReceivedConfirmed: true, reference: 'CASH-REC-001',
    } as any, user)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });

  it('allocates interest first, then principal, and posts a matching cashbook receipt', async () => {
    const result = await service.create({
      loanId: loan.id,
      amount: 3000,
      method: 'CASH',
      cashReceivedConfirmed: true,
      reference: 'CASH-REC-001',
      paymentDate: '2026-06-01',
    } as any, user);

    expect(result.interestPaid).toBe(1000);
    expect(result.principalPaid).toBe(2000);
    expect(result.interestOutstanding).toBe(0);
    expect(result.principalOutstanding).toBe(8000);
    expect(prisma.cashbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        branchId: 'branch-1',
        staffId: 'staff-1',
        type: 'CASH_IN',
        amount: 3000,
        reference: 'REPAY-CASH-REC-001',
      }),
    }));
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'LOAN_REPAYMENT', amount: 3000 }),
    }));
  });

  it('rejects repayments greater than the outstanding loan balance', async () => {
    prisma.loan.findUnique.mockResolvedValue({ ...loan, amount: 1000 });
    await expect(service.create({
      loanId: loan.id, amount: 2000, method: 'CASH',
      cashReceivedConfirmed: true, reference: 'CASH-REC-002',
    } as any, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.cashbookEntry.create).not.toHaveBeenCalled();
  });

  it('rejects electronic payment methods from the physical cash route', async () => {
    await expect(service.create({
      loanId: loan.id, amount: 2000, method: 'BANK_TRANSFER',
      cashReceivedConfirmed: true, reference: 'BANK-REC-001',
    } as any, user)).rejects.toThrow('Manual repayments accept physical cash only');
  });

  it('requires physical cash receipt confirmation', async () => {
    await expect(service.create({
      loanId: loan.id, amount: 2000, method: 'CASH',
      cashReceivedConfirmed: false, reference: 'CASH-REC-003',
    } as any, user)).rejects.toThrow('physically been received and counted');
  });
});
