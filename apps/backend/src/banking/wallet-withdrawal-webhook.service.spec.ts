import { WalletWithdrawalWebhookService } from './wallet-withdrawal-webhook.service';

describe('WalletWithdrawalWebhookService reconciliation balance locking', () => {
  it('serializes failed withdrawal reconciliation and restores from the post-lock balance', async () => {
    const transaction = {
      id: 'withdrawal-1',
      reference: 'WITHDRAWAL-REF-001',
      customerId: 'customer-1',
      type: 'WITHDRAWAL',
      status: 'PENDING',
      amount: 20,
      provider: 'FLUTTERWAVE',
      providerReference: 'provider-ref-1',
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(transaction),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...transaction, ...data })),
      },
      customerWallet: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'wallet-1', customerId: 'customer-1', balance: 80, status: 'ACTIVE' })
          .mockResolvedValueOnce({ id: 'wallet-1', customerId: 'customer-1', balance: 125, status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({ id: 'wallet-1', customerId: 'customer-1', balance: 145, status: 'ACTIVE' }),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    const service = new WalletWithdrawalWebhookService(prisma as any, {} as any);

    const result = await (service as any).applyReconciliation({
      transactionReference: transaction.reference,
      status: 'FAILED',
      provider: 'FLUTTERWAVE',
      providerReference: 'provider-ref-1',
    });

    expect(result).toMatchObject({ ok: true, duplicate: false, action: 'REFUNDED' });
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'WALLET-WITHDRAWAL:WITHDRAWAL-REF-001',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-1',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: 145 },
    });
    expect(tx.walletTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'withdrawal-1' },
      data: expect.objectContaining({ status: 'FAILED', newBalance: 145 }),
    }));
  });

  it('does not restore a withdrawal again when its failure was already recorded', async () => {
    const transaction = {
      id: 'withdrawal-2',
      reference: 'WITHDRAWAL-REF-002',
      customerId: 'customer-1',
      type: 'WITHDRAWAL',
      status: 'FAILED',
      amount: 20,
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: { findUnique: jest.fn().mockResolvedValue(transaction), update: jest.fn() },
      customerWallet: { findUnique: jest.fn(), update: jest.fn() },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    const service = new WalletWithdrawalWebhookService(prisma as any, {} as any);

    await expect((service as any).applyReconciliation({
      transactionReference: transaction.reference,
      status: 'FAILED',
    })).resolves.toMatchObject({ ok: true, duplicate: true });
    expect(tx.customerWallet.findUnique).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
  });
});
