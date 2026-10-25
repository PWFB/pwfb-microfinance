import { BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';

describe('BankingService wallet flows with fixed-precision balances', () => {
  let service: BankingService;
  let prisma: any;
  let tx: any;

  const sender = { id: 'test-customer-a', firstName: 'Test', lastName: 'Sender' };
  const recipient = { id: 'test-customer-b', firstName: 'Test', lastName: 'Recipient' };
  const numeric = (value: any) => Number(value?.toString?.() ?? value);

  beforeEach(() => {
    tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      customer: { findUnique: jest.fn() },
      customerWallet: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id,
          ...data,
          status: 'ACTIVE',
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'test-tx', ...data })),
        findMany: jest.fn(),
      },
    };
    prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new BankingService(prisma);
  });

  it('locks and re-reads the wallet before a deposit, then records exact ledger balances', async () => {
    tx.customer.findUnique.mockResolvedValue(sender);
    tx.customerWallet.upsert.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 0, status: 'ACTIVE' });
    tx.customerWallet.findUnique.mockResolvedValue({ id: 'wallet-a', customerId: sender.id, balance: 350, status: 'ACTIVE' });

    const result = await service.deposit(sender.id, { amount: 2500, reference: 'TEST-DEP-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-a' },
      data: { balance: expect.anything() },
    });
    expect(numeric(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(2850);
    const ledger = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(numeric(ledger.amount)).toBe(2500);
    expect(numeric(ledger.previousBalance)).toBe(350);
    expect(numeric(ledger.newBalance)).toBe(2850);
    expect(result.wallet.balance).toBe(2850);
    expect(result.transaction.type).toBe('DEPOSIT');
  });

  it('rejects zero or invalid deposits before opening a database transaction', async () => {
    await expect(service.deposit(sender.id, { amount: 0 })).rejects.toThrow(BadRequestException);
    await expect(service.deposit(sender.id, { amount: 'not-a-number' })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the post-lock balance for a withdrawal and prevents stale-balance overwrites', async () => {
    tx.customerWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 3000, status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 3200, status: 'ACTIVE' });

    const result = await service.withdraw(sender.id, { amount: 750, reference: 'TEST-WDR-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(numeric(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(2450);
    const ledger = tx.walletTransaction.create.mock.calls[0][0].data;
    expect(numeric(ledger.amount)).toBe(750);
    expect(numeric(ledger.previousBalance)).toBe(3200);
    expect(numeric(ledger.newBalance)).toBe(2450);
    expect(result.wallet.balance).toBe(2450);
  });

  it('rejects a withdrawal that exceeds the post-lock balance without debiting', async () => {
    tx.customerWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 100, status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 100, status: 'ACTIVE' });

    await expect(service.withdraw(sender.id, { amount: 101 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('serializes both customer and wallet rows and keeps transfer debit/credit ledgers balanced', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    tx.customerWallet.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.customerId === sender.id) return { id: 'wallet-a', customerId: sender.id, balance: 2000, status: 'ACTIVE' };
      if (where.id === 'wallet-a') return { id: 'wallet-a', customerId: sender.id, balance: 2200, status: 'ACTIVE' };
      if (where.id === 'wallet-b') return { id: 'wallet-b', customerId: recipient.id, balance: 400, status: 'ACTIVE' };
      return null;
    });
    tx.customerWallet.upsert.mockResolvedValue({ id: 'wallet-b', customerId: recipient.id, balance: 300, status: 'ACTIVE' });

    const result = await service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 500, reference: 'TEST-TRF-001' });

    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CUSTOMER-WALLET-TRANSFER:test-customer-a',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CUSTOMER-WALLET-TRANSFER:test-customer-b',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      3,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-a',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      4,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-b',
    );
    expect(numeric(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(1700);
    expect(numeric(tx.customerWallet.update.mock.calls[1][0].data.balance)).toBe(900);
    const outgoing = tx.walletTransaction.create.mock.calls[0][0].data;
    const incoming = tx.walletTransaction.create.mock.calls[1][0].data;
    expect(numeric(outgoing.amount)).toBe(500);
    expect(numeric(outgoing.previousBalance)).toBe(2200);
    expect(numeric(outgoing.newBalance)).toBe(1700);
    expect(numeric(incoming.amount)).toBe(500);
    expect(numeric(incoming.previousBalance)).toBe(400);
    expect(numeric(incoming.newBalance)).toBe(900);
    expect(result.senderWallet.balance).toBe(1700);
    expect(result.recipientWallet.balance).toBe(900);
  });

  it('rejects self-transfers before opening a database transaction', async () => {
    await expect(service.transfer(sender.id, { recipientCustomerId: sender.id, amount: 100 })).rejects.toThrow('same customer');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a withdrawal if the wallet was suspended before the post-lock read', async () => {
    tx.customerWallet.findUnique
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 1000, status: 'ACTIVE' })
      .mockResolvedValueOnce({ id: 'wallet-a', customerId: sender.id, balance: 1000, status: 'SUSPENDED' });

    await expect(service.withdraw(sender.id, { amount: 100 })).rejects.toThrow('Customer wallet is not active');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects transfers with insufficient sender funds after taking both row locks', async () => {
    tx.customer.findUnique.mockResolvedValueOnce(sender).mockResolvedValueOnce(recipient);
    tx.customerWallet.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.customerId === sender.id) return { id: 'wallet-a', customerId: sender.id, balance: 50, status: 'ACTIVE' };
      if (where.id === 'wallet-a') return { id: 'wallet-a', customerId: sender.id, balance: 50, status: 'ACTIVE' };
      if (where.id === 'wallet-b') return { id: 'wallet-b', customerId: recipient.id, balance: 10, status: 'ACTIVE' };
      return null;
    });
    tx.customerWallet.upsert.mockResolvedValue({ id: 'wallet-b', customerId: recipient.id, balance: 10, status: 'ACTIVE' });

    await expect(service.transfer(sender.id, { recipientCustomerId: recipient.id, amount: 100 })).rejects.toThrow('Insufficient wallet balance');
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
