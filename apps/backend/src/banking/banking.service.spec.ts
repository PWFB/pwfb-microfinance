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
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
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
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 350, status: 'ACTIVE' });
    tx.customerWallet.update.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 2850, status: 'ACTIVE' });

    const result = await service.deposit(sender.id, { amount: 2500, reference: 'TEST-DEP-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(tx.customerWallet.findUnique).toHaveBeenCalledWith({ where: { id: 'wallet-a' } });
    expect(tx.customerWallet.update).toHaveBeenCalledWith({ where: { id: 'wallet-a' }, data: { balance: 2850 } });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'DEPOSIT', amount: 2500, previousBalance: 350, newBalance: 2850, reference: 'TEST-DEP-001', status: 'COMPLETED' }),
    }));
    expect(result.transaction.type).toBe('DEPOSIT');
  });

  it('rejects zero or invalid deposits before opening a database transaction', async () => {
    await expect(service.deposit(sender.id, { amount: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.deposit(sender.id, { amount: 'not-a-number' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records a withdrawal only when sufficient funds are available', async () => {
    tx.customerWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 3000, status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 3200, status: 'ACTIVE' });
    tx.customerWallet.update.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 2450, status: 'ACTIVE' });

    const result = await service.withdraw(sender.id, { amount: 750, reference: 'TEST-WDR-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-a' },
      data: { balance: 2450 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'WITHDRAWAL', amount: 750, previousBalance: 3200, newBalance: 2450, reference: 'TEST-WDR-001' }),
    }));
    expect(result.wallet.balance).toBe(2450);
  });

  it('rejects a withdrawal that exceeds the available balance without debiting', async () => {
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 100, status: 'ACTIVE' });

    await expect(service.withdraw(sender.id, { amount: 101 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('transfers funds between customers with matching debit and credit ledger entries', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    const senderWalletInitial = { id: 'wallet-a', customerId: sender.id, balance: 2000, status: 'ACTIVE' };
    const recipientWalletInitial = { id: 'wallet-b', customerId: recipient.id, balance: 300, status: 'ACTIVE' };
    const senderWalletLocked = { ...senderWalletInitial, balance: 2200 };
    const recipientWalletLocked = { ...recipientWalletInitial, balance: 400 };
    tx.customerWallet.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.customerId === sender.id) return senderWalletInitial;
      if (where.customerId === recipient.id) return recipientWalletInitial;
      if (where.id === 'wallet-a') return senderWalletLocked;
      if (where.id === 'wallet-b') return recipientWalletLocked;
      return null;
    });
    tx.customerWallet.update.mockImplementation(async ({ where, data }: any) =>
      where.id === 'wallet-a'
        ? { ...senderWalletLocked, ...data }
        : { ...recipientWalletLocked, ...data },
    );

    const result = await service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 500, reference: 'TEST-TRF-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CUSTOMER-WALLET-TRANSFER:' + sender.id,
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2, 'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CUSTOMER-WALLET-TRANSFER:' + recipient.id,
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      3, 'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      4, 'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-b',
    );
    expect(tx.customerWallet.update).toHaveBeenNthCalledWith(1, { where: { id: 'wallet-a' }, data: { balance: 1700 } });
    expect(tx.customerWallet.update).toHaveBeenNthCalledWith(2, { where: { id: 'wallet-b' }, data: { balance: 900 } });
    expect(tx.walletTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ customerId: sender.id, type: 'TRANSFER_OUT', amount: 500, previousBalance: 2200, newBalance: 1700, reference: 'TEST-TRF-001-OUT' }),
    }));
    expect(tx.walletTransaction.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ customerId: recipient.id, type: 'TRANSFER_IN', amount: 500, previousBalance: 400, newBalance: 900, reference: 'TEST-TRF-001-IN' }),
    }));
    expect(result.senderWallet.balance).toBe(1700);
    expect(result.recipientWallet.balance).toBe(900);
  });

  it('rejects self-transfers before opening a database transaction', async () => {
    await expect(service.transfer(sender.id, { recipientCustomerId: sender.id, amount: 100 })).rejects.toThrow('same customer');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal if the wallet is suspended before the post-lock re-read', async () => {
    tx.customerWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 1000, status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 1000, status: 'SUSPENDED' });

    await expect(service.withdraw(sender.id, { amount: 100 })).rejects.toThrow('Customer wallet is not active');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects transfers when sender funds are insufficient', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    tx.customerWallet.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.customerId === sender.id) return { id: 'wallet-a', customerId: sender.id, balance: 50, status: 'ACTIVE' };
      if (where.customerId === recipient.id) return { id: 'wallet-b', customerId: recipient.id, balance: 10, status: 'ACTIVE' };
      if (where.id === 'wallet-a') return { id: 'wallet-a', customerId: sender.id, balance: 50, status: 'ACTIVE' };
      if (where.id === 'wallet-b') return { id: 'wallet-b', customerId: recipient.id, balance: 10, status: 'ACTIVE' };
      return null;
    });

    await expect(service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 100 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
