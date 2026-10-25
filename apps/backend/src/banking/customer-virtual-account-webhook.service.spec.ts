import { createHmac } from 'node:crypto';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';

describe('CustomerVirtualAccountWebhookService', () => {
  let service: CustomerVirtualAccountWebhookService;
  let prisma: any;
  let tx: any;
  const secret = 'test-only-flutterwave-webhook-secret';

  beforeEach(() => {
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = secret;
    tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'test-tx-1', ...data })),
      },
      customerVirtualAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'test-va-1',
          customerId: 'test-customer-1',
          branchId: 'test-branch-1',
          accountNumber: '1234567890',
          status: 'ACTIVE',
        }),
      },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'test-wallet-1', customerId: 'test-customer-1', balance: 0, status: 'ACTIVE' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'test-wallet-1', customerId: 'test-customer-1', balance: 125, status: 'ACTIVE' }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'test-wallet-1', ...data, status: 'ACTIVE' })),
      },
    };
    prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new CustomerVirtualAccountWebhookService(prisma);
  });

  afterEach(() => {
    delete process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  });

  function signed(body: any) {
    const raw = JSON.stringify(body);
    return {
      body,
      rawBody: Buffer.from(raw),
      signature: createHmac('sha256', secret).update(raw).digest('base64'),
    };
  }

  it('credits an active virtual account exactly once for a successful NGN event', async () => {
    const input = signed({
      event: 'charge.completed',
      data: {
        status: 'successful',
        account_number: '123-456-7890',
        amount: 2500,
        currency: 'NGN',
        tx_ref: 'flw-test-reference-001',
      },
    });

    const result = await service.depositFlutterwave(input);

    expect(result).toMatchObject({ ok: true, duplicate: false });
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CUSTOMER-VA-DEPOSIT:flw-test-reference-001',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'test-wallet-1',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'test-wallet-1' },
      data: { balance: 2625 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'test-customer-1',
        type: 'DEPOSIT',
        amount: 2500,
        previousBalance: 125,
        newBalance: 2625,
        provider: 'FLUTTERWAVE',
        providerReference: 'flw-test-reference-001',
        status: 'COMPLETED',
      }),
    }));
  });

  it('does not credit twice when the provider reference already exists', async () => {
    tx.walletTransaction.findUnique.mockResolvedValue({ id: 'existing-tx', providerReference: 'flw-test-reference-001' });
    const input = signed({
      event: 'charge.completed',
      data: {
        status: 'successful',
        account_number: '1234567890',
        amount: 2500,
        currency: 'NGN',
        tx_ref: 'flw-test-reference-001',
      },
    });

    const result = await service.depositFlutterwave(input);

    expect(result).toMatchObject({ ok: true, duplicate: true });
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects a bad provider signature before accessing the database', async () => {
    const input = signed({
      data: { status: 'successful', account_number: '1234567890', amount: 2500, currency: 'NGN', tx_ref: 'bad-signature-ref' },
    });

    await expect(service.depositFlutterwave({ ...input, signature: 'invalid' })).rejects.toThrow('Invalid Flutterwave webhook signature');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('ignores non-successful provider events without crediting a wallet', async () => {
    const input = signed({
      event: 'charge.completed',
      data: { status: 'failed', account_number: '1234567890', amount: 2500, currency: 'NGN', tx_ref: 'flw-failed-ref' },
    });

    await expect(service.depositFlutterwave(input)).resolves.toMatchObject({
      ok: true,
      ignored: true,
      reason: 'non-successful-event',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a successful event for an unknown virtual account', async () => {
    tx.customerVirtualAccount.findFirst.mockResolvedValue(null);
    const input = signed({
      event: 'charge.completed',
      data: { status: 'successful', account_number: '1234567890', amount: 2500, currency: 'NGN', tx_ref: 'unknown-account-ref' },
    });

    await expect(service.depositFlutterwave(input)).rejects.toThrow('Active customer virtual account not found');
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
