import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const prisma = {
    customer: { findUnique: jest.fn() },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    walletTransaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionsService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a transaction for an existing customer', async () => {
    const dto = { customerId: 'customer-1', type: 'DEPOSIT', amount: 5000, description: 'Cash deposit' };
    const result = { id: 'transaction-1', ...dto };
    prisma.customer.findUnique.mockResolvedValue({ id: 'customer-1' });
    prisma.transaction.create.mockResolvedValue(result);

    await expect(service.create(dto)).resolves.toBe(result);
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: dto,
      include: { customer: true },
    });
  });

  it('should reject creation when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.create({ customerId: 'missing', type: 'DEPOSIT', amount: 1000 } as any))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('should combine legacy ledger and wallet transactions in newest-first order', async () => {
    prisma.transaction.findMany.mockResolvedValue([{
      id: 'legacy-1',
      customerId: 'customer-1',
      type: 'DEPOSIT',
      amount: 5000,
      createdAt: new Date('2026-01-01T10:00:00Z'),
    }]);
    prisma.walletTransaction.findMany.mockResolvedValue([{
      id: 'wallet-1',
      customerId: 'customer-1',
      type: 'WITHDRAWAL',
      amount: 1000,
      description: 'Wallet withdrawal',
      status: 'COMPLETED',
      provider: null,
      providerReference: null,
      reference: 'ref-1',
      processedAt: new Date('2026-01-01T11:00:00Z'),
      previousBalance: 5000,
      newBalance: 4000,
      createdAt: new Date('2026-01-01T11:00:00Z'),
      branchId: null,
      staffId: null,
      failureReason: null,
      customer: { id: 'customer-1' },
    }]);

    const result = await service.findAll();

    expect(result.map((row: any) => row.id)).toEqual(['wallet-1', 'legacy-1']);
    expect(result[0]).toMatchObject({
      source: 'WALLET',
      walletBalanceBefore: 5000,
      walletBalanceAfter: 4000,
      status: 'COMPLETED',
    });
    expect(result[1]).toMatchObject({
      source: 'LEDGER',
      status: 'COMPLETED',
    });
  });

  it('should return wallet transaction details by id', async () => {
    const wallet = {
      id: 'wallet-1',
      customerId: 'customer-1',
      type: 'DEPOSIT',
      amount: 2500,
      description: 'Deposit',
      status: 'COMPLETED',
      provider: 'INTERNAL',
      providerReference: 'ref-1',
      reference: 'ref-1',
      processedAt: new Date(),
      previousBalance: 1000,
      newBalance: 3500,
      createdAt: new Date(),
      branchId: 'branch-1',
      staffId: 'staff-1',
      failureReason: null,
      customer: { id: 'customer-1' },
    };
    prisma.walletTransaction.findUnique.mockResolvedValue(wallet);

    await expect(service.findOne('wallet-1')).resolves.toMatchObject({
      id: 'wallet-1',
      source: 'WALLET',
      walletBalanceBefore: 1000,
      walletBalanceAfter: 3500,
    });
    expect(prisma.transaction.findUnique).not.toHaveBeenCalled();
  });

  it('should reject edits to system-generated wallet transactions', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wallet-1', source: 'WALLET' } as any);
    await expect(service.update('wallet-1', {} as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.remove('wallet-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject edits and deletion of immutable ledger transactions', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'legacy-1', source: 'LEDGER' } as any);
    await expect(service.update('legacy-1', {} as any)).rejects.toThrow('Ledger transactions are immutable');
    await expect(service.remove('legacy-1')).rejects.toThrow('Ledger transactions are immutable');
  });

  it('should throw when transaction does not exist', async () => {
    prisma.walletTransaction.findUnique.mockResolvedValue(null);
    prisma.transaction.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing-transaction')).rejects.toBeInstanceOf(NotFoundException);
  });
});
