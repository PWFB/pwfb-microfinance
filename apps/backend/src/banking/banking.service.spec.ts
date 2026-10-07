import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BankingService } from './banking.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BankingService financial regression', () => {
  let service: BankingService;
  let tx: any;
  let prisma: any;

  beforeEach(() => {
    tx = {
      customer: { findUnique: jest.fn() },
      customerWallet: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      walletTransaction: { create: jest.fn() },
    };
    prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new BankingService(prisma as PrismaService);
  });

  it('deposit increases balance and records an auditable wallet transaction', async () => {
    tx.customer.findUnique.mockResolvedValue({ id: 'c1' });
    tx.customerWallet.upsert.mockResolvedValue({ id: 'w1', customerId: 'c1', balance: 1000, status: 'ACTIVE' });
    tx.customerWallet.update.mockResolvedValue({ id: 'w1', customerId: 'c1', balance: 1500, status: 'ACTIVE' });
    tx.walletTransaction.create.mockResolvedValue({
      id: 't1', type: 'DEPOSIT', amount: 500, previousBalance: 1000, newBalance: 1500,
    });

    const result = await service.deposit('c1', { amount: 500, reference: 'DEP-001' });

    expect(result.wallet.balance).toBe(1500);
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'w1' },
      data: { balance: 1500 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'c1',
        type: 'DEPOSIT',
        amount: 500,
        previousBalance: 1000,
        newBalance: 1500,
        reference: 'DEP-001',
        status: 'COMPLETED',
      }),
    }));
  });

  it('withdrawal refuses insufficient funds and does not create a transaction', async () => {
    tx.customerWallet.findUnique.mockResolvedValue({
      id: 'w1', customerId: 'c1', balance: 400, status: 'ACTIVE',
    });

    await expect(service.withdraw('c1', { amount: 500 }))
      .rejects.toThrow(new BadRequestException('Insufficient wallet balance'));

    expect(tx.customerWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('withdrawal decreases balance atomically and records before/after balances', async () => {
    tx.customerWallet.findUnique.mockResolvedValue({
      id: 'w1', customerId: 'c1', balance: 1000, status: 'ACTIVE',
    });
    tx.customerWallet.updateMany.mockResolvedValue({ count: 1 });
    tx.walletTransaction.create.mockResolvedValue({
      id: 't2', type: 'WITHDRAWAL', amount: 250, previousBalance: 1000, newBalance: 750,
    });

    const result = await service.withdraw('c1', { amount: 250, reference: 'WDR-001' });

    expect(result.wallet.balance).toBe(750);
    expect(tx.customerWallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'w1', balance: { gte: 250 }, status: 'ACTIVE' },
      data: { balance: 750 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'WITHDRAWAL',
        previousBalance: 1000,
        newBalance: 750,
        reference: 'WDR-001',
      }),
    }));
  });

  it('transfer moves equal value out of sender and into recipient with paired ledger records', async () => {
    tx.customer.findUnique
      .mockResolvedValueOnce({ id: 'c1', firstName: 'Sender', lastName: 'One' })
      .mockResolvedValueOnce({ id: 'c2', firstName: 'Receiver', lastName: 'Two' });
    tx.customerWallet.findUnique.mockResolvedValue({
      id: 'w1', customerId: 'c1', balance: 1000, status: 'ACTIVE',
    });
    tx.customerWallet.upsert.mockResolvedValue({
      id: 'w2', customerId: 'c2', balance: 200, status: 'ACTIVE',
    });
    tx.customerWallet.updateMany.mockResolvedValue({ count: 1 });
    tx.customerWallet.update.mockResolvedValue({
      id: 'w2', customerId: 'c2', balance: 450, status: 'ACTIVE',
    });
    tx.walletTransaction.create
      .mockResolvedValueOnce({ id: 'out', type: 'TRANSFER_OUT', amount: 250 })
      .mockResolvedValueOnce({ id: 'in', type: 'TRANSFER_IN', amount: 250 });

    const result = await service.transfer('c1', {
      recipientCustomerId: 'c2',
      amount: 250,
      reference: 'TRF-001',
    });

    expect(result.senderWallet.balance).toBe(750);
    expect(result.recipientWallet.balance).toBe(450);
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({
        type: 'TRANSFER_OUT',
        amount: 250,
        previousBalance: 1000,
        newBalance: 750,
        reference: 'TRF-001-OUT',
      }),
    }));
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({
        type: 'TRANSFER_IN',
        amount: 250,
        previousBalance: 200,
        newBalance: 450,
        reference: 'TRF-001-IN',
      }),
    }));
  });

  it('transfer rejects self-transfer before opening a database transaction', async () => {
    await expect(service.transfer('c1', {
      recipientCustomerId: 'c1',
      amount: 100,
    })).rejects.toThrow(new BadRequestException('You cannot transfer to the same customer'));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('transfer rejects a missing recipient', async () => {
    tx.customer.findUnique
      .mockResolvedValueOnce({ id: 'c1' })
      .mockResolvedValueOnce(null);

    await expect(service.transfer('c1', {
      recipientCustomerId: 'missing',
      amount: 100,
    })).rejects.toThrow(new NotFoundException('Recipient customer not found'));

    expect(tx.customerWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
