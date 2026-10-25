import { WalletWithdrawalWebhookService } from './wallet-withdrawal-webhook.service';

describe('WalletWithdrawalWebhookService reconciliation concurrency', () => {
  let service: WalletWithdrawalWebhookService;
  let prisma: any;
  let tx: any;
  let transaction: any;
  const secret = 'test-only-legacy-webhook-secret';

  beforeEach(() => {
    process.env.PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET = secret;
    transaction = {
      id: 'withdrawal-transaction-1',
      reference: 'TEST-WITHDRAWAL-001',
      customerId: 'test-customer-1',
      type: 'WITHDRAWAL',
      status: 'PENDING',
      amount: 50,
      previousBalance: 150,
      newBalance: 100,
      provider: 'FLUTTERWAVE',
      providerReference: 'provider-transfer-1',
    };
    tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findUnique: jest.fn().mockImplementation(async () => ({ ...transaction })),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          transaction = { ...transaction, ...data };
          return { ...transaction };
        }),
      },
      customerWallet: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.customerId) {
            return { id: 'wallet-1', customerId: 'test-customer-1', balance: 100, status: 'ACTIVE' };
          }
          if (where.id === 'wallet-1') {
            return { id: 'wallet-1', customerId: 'test-customer-1', balance: 150, status: 'ACTIVE' };
          }
          return null;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id,
          customerId: 'test-customer-1',
          status: 'ACTIVE',
          ...data,
        })),
      },
    };
    prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new WalletWithdrawalWebhookService(prisma, {} as any);
  });

  afterEach(() => {
    delete process.env.PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET;
  });

  it('locks the withdrawal reference and re-reads the wallet before refunding', async () => {
    const result = await service.reconcile({
      transactionReference: 'TEST-WITHDRAWAL-001',
      status: 'FAILED',
      provider: 'FLUTTERWAVE',
      failureReason: 'Provider rejected transfer',
      secret,
    });

    expect(result).toMatchObject({ ok: true, duplicate: false, action: 'REFUNDED' });
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'WALLET-WITHDRAWAL-RECONCILE:TEST-WITHDRAWAL-001',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-1',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: expect.anything() },
    });
    expect(Number(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(200);
    expect(tx.walletTransaction.update).toHaveBeenCalledWith({
      where: { id: 'withdrawal-transaction-1' },
      data: expect.objectContaining({ status: 'FAILED', newBalance: expect.anything() }),
    });
    expect(Number(tx.walletTransaction.update.mock.calls[0][0].data.newBalance)).toBe(200);
  });

  it('does not restore a completed withdrawal when a contradictory failure event arrives', async () => {
    transaction.status = 'COMPLETED';

    await expect(service.reconcile({
      transactionReference: 'TEST-WITHDRAWAL-001',
      status: 'FAILED',
      secret,
    })).resolves.toMatchObject({ ok: true, duplicate: true });

    expect(tx.customerWallet.findUnique).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
  });

  it('does not restore the wallet twice for duplicate failure callbacks', async () => {
    transaction.status = 'FAILED';

    await expect(service.reconcile({
      transactionReference: 'TEST-WITHDRAWAL-001',
      status: 'FAILED',
      secret,
    })).resolves.toMatchObject({ ok: true, duplicate: true });

    expect(tx.customerWallet.findUnique).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
  });
});
