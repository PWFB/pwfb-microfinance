import { BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService wallet flows', () => {
  let service: BankingService;
  let prisma: any;
  let tx: any;

  const sender = { id: 'test-customer-a', firstName: 'Test', lastName: 'Sender' };
  const recipient = { id: 'test-customer-b', firstName: 'Test', lastName: 'Recipient' };

  beforeEach(() => {
    tx = {
      customer: { findUnique: jest.fn() },
      customerWallet: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: { create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'test-tx', ...data })) },
    };
    prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new BankingService(prisma);
  });

  it('records a deposit and updates the wallet balance atomically', async () => {
    tx.customer.findUnique.mockResolvedValue(sender);
    tx.customerWallet.upsert.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 0, status: 'ACTIVE' });
    tx.customerWallet.update.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 2500, status: 'ACTIVE' });

    const result = await service.deposit(sender.id, { amount: 2500, reference: 'TEST-DEP-001' });

    expect(tx.customerWallet.update).toHaveBeenCalledWith({ where: { id: 'wallet-a' }, data: { balance: 2500 } });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'DEPOSIT', amount: 2500, previousBalance: 0, newBalance: 2500, reference: 'TEST-DEP-001', status: 'COMPLETED' }),
    }));
    expect(result.transaction.type).toBe('DEPOSIT');
  });

  it('rejects zero or invalid deposits before opening a database transaction', async () => {
    await expect(service.deposit(sender.id, { amount: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.deposit(sender.id, { amount: 'not-a-number' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records a withdrawal only when sufficient funds are available', async () => {
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 3000, status: 'ACTIVE' });

    const result = await service.withdraw(sender.id, { amount: 750, reference: 'TEST-WDR-001' });

    expect(tx.customerWallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-a', balance: { gte: 750 }, status: 'ACTIVE' },
      data: { balance: 2250 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'WITHDRAWAL', amount: 750, previousBalance: 3000, newBalance: 2250, reference: 'TEST-WDR-001' }),
    }));
    expect(result.wallet.balance).toBe(2250);
  });

  it('rejects a withdrawal that exceeds the available balance without debiting', async () => {
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 100, status: 'ACTIVE' });

    await expect(service.withdraw(sender.id, { amount: 101 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('transfers funds between customers with matching debit and credit ledger entries', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 2000, status: 'ACTIVE' });
    tx.customerWallet.upsert.mockResolvedValue({ id: 'wallet-b', customerId: recipient.id, balance: 300, status: 'ACTIVE' });
    tx.customerWallet.update.mockResolvedValue({ id: 'wallet-b', customerId: recipient.id, balance: 800, status: 'ACTIVE' });

    const result = await service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 500, reference: 'TEST-TRF-001' });

    expect(tx.customerWallet.updateMany).toHaveBeenCalledWith({
      where: { id: 'wallet-a', balance: { gte: 500 }, status: 'ACTIVE' },
      data: { balance: 1500 },
    });
    expect(tx.customerWallet.update).toHaveBeenCalledWith({ where: { id: 'wallet-b' }, data: { balance: 800 } });
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'TRANSFER_OUT', amount: 500, previousBalance: 2000, newBalance: 1500, reference: 'TEST-TRF-001-OUT' }),
    }));
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ customerId: recipient.id, type: 'TRANSFER_IN', amount: 500, previousBalance: 300, newBalance: 800, reference: 'TEST-TRF-001-IN' }),
    }));
    expect(result.senderWallet.balance).toBe(1500);
    expect(result.recipientWallet.balance).toBe(800);
  });

  it('rejects self-transfers before opening a database transaction', async () => {
    await expect(service.transfer(sender.id, { recipientCustomerId: sender.id, amount: 100 })).rejects.toThrow('same customer');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects transfers when sender funds are insufficient', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 50, status: 'ACTIVE' });

    await expect(service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 100 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.updateMany).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
