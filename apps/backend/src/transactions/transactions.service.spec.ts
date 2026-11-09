import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  const prisma = {
    customer: { findUnique: jest.fn() },
    transaction: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    walletTransaction: { findMany: jest.fn(), findUnique: jest.fn() },
  } as any;
  const accessScope = {
    getScope: jest.fn(),
    getScopedBranchIds: jest.fn(),
    assertCustomer: jest.fn(),
    assertTransaction: jest.fn(),
  } as any;
  const user = { id: 'user-1', role: 'CREDIT_OFFICER', staffId: 'staff-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    accessScope.getScope.mockResolvedValue({ global: false, role: 'CREDIT_OFFICER', staffId: 'staff-1' });
    accessScope.getScopedBranchIds.mockResolvedValue(['branch-1']);
    service = new TransactionsService(prisma, accessScope);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('creates a transaction only after validating the customer against the caller scope', async () => {
    const dto = { customerId: 'customer-1', type: 'DEPOSIT', amount: 5000, description: 'Cash deposit' };
    const result = { id: 'transaction-1', ...dto };
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.transaction.create.mockResolvedValue(result);

    await expect(service.create(dto as any, user)).resolves.toBe(result);
    expect(accessScope.assertCustomer).toHaveBeenCalledWith(user, 'customer-1');
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: dto,
      include: { customer: true },
    });
  });

  it('rejects creation when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.create({ customerId: 'missing', type: 'DEPOSIT', amount: 1000 } as any, user))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('queries ledger and wallet transactions only for the caller branch and assigned customers', async () => {
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    await service.findAll(user);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customer: { branchId: { in: ['branch-1'] }, assignedStaffId: 'staff-1' } },
    }));
    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { branchId: { in: ['branch-1'] }, customer: { branchId: { in: ['branch-1'] }, assignedStaffId: 'staff-1' } },
          { branchId: null, customer: { branchId: { in: ['branch-1'] }, assignedStaffId: 'staff-1' } },
        ],
      },
    }));
  });

  it('checks the transaction owner before reading details', async () => {
    prisma.walletTransaction.findUnique.mockResolvedValue(null);
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.findOne('tx-1', user)).rejects.toBeInstanceOf(NotFoundException);
    expect(accessScope.assertTransaction).toHaveBeenCalledWith(user, 'tx-1');
  });

  it('rejects edits and deletion of immutable transaction rows after checking caller scope', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wallet-1', source: 'WALLET' } as any);
    await expect(service.update('wallet-1', {} as any, user)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove('wallet-1', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(service.findOne).toHaveBeenCalledWith('wallet-1', user);
  });
});
