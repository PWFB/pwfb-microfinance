import { NotFoundException } from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService customer transaction history', () => {
  let service: BankingService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      transaction: { findMany: jest.fn() },
      walletTransaction: { findMany: jest.fn() },
    };
    service = new BankingService(prisma);
  });

  it('merges savings ledger and wallet records while preserving references', async () => {
    const customerId = 'customer-1';
    const older = new Date('2026-11-18T08:00:00.000Z');
    const middle = new Date('2026-11-18T10:00:00.000Z');
    const newer = new Date('2026-11-18T11:00:00.000Z');

    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'savings-withdrawal',
        customerId,
        type: 'Withdrawal',
        amount: 250,
        reference: 'PWFB-SAV-WDR-001',
        description: 'Fixed savings withdrawal',
        createdAt: older,
        updatedAt: older,
      },
      {
        id: 'savings-deposit',
        customerId,
        type: 'Deposit',
        amount: 1500,
        reference: 'PWFB-SAV-DEP-001',
        description: 'Fixed savings deposit',
        createdAt: middle,
        updatedAt: middle,
      },
    ]);
    prisma.walletTransaction.findMany.mockResolvedValue([
      {
        id: 'wallet-deposit',
        customerId,
        type: 'DEPOSIT',
        amount: 500,
        reference: 'PWFB-DEP-001',
        status: 'COMPLETED',
        createdAt: newer,
        updatedAt: newer,
      },
    ]);

    const history = await service.getCustomerTransactions(customerId);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { id: customerId },
    });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
    expect(history.map((entry: any) => entry.id)).toEqual([
      'wallet-deposit',
      'savings-deposit',
      'savings-withdrawal',
    ]);
    expect(history[1]).toMatchObject({
      type: 'DEPOSIT',
      source: 'LEDGER',
      status: 'COMPLETED',
      reference: 'PWFB-SAV-DEP-001',
      processedAt: middle,
    });
    expect(history[2]).toMatchObject({
      type: 'WITHDRAWAL',
      source: 'LEDGER',
      reference: 'PWFB-SAV-WDR-001',
    });
    expect(history[0]).toMatchObject({
      type: 'DEPOSIT',
      source: 'WALLET',
      reference: 'PWFB-DEP-001',
      status: 'COMPLETED',
    });
  });

  it('does not query transactions for an unknown customer', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.getCustomerTransactions('missing-customer'),
    ).rejects.toThrow(NotFoundException);

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
    expect(prisma.walletTransaction.findMany).not.toHaveBeenCalled();
  });
});
