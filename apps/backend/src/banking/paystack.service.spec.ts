import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { PaystackService } from './paystack.service';

describe('PaystackService payment verification ownership', () => {
  function createService(paymentCustomerId: string) {
    const service = new PaystackService({} as any);
    (service as any).request = jest.fn().mockResolvedValue({
      data: { status: 'success', metadata: { customerId: paymentCustomerId } },
    });
    (service as any).handleWebhook = jest.fn().mockResolvedValue({ ok: true, processed: true });
    return service;
  }

  it('rejects a customer attempting to verify another customer payment', async () => {
    const service = createService('customer-owner');
    await expect(service.verifyAndCredit('payment-reference', {
      role: 'CUSTOMER',
      customerId: 'different-customer',
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect((service as any).handleWebhook).not.toHaveBeenCalled();
  });

  it('allows a customer to verify their own successful payment', async () => {
    const service = createService('customer-owner');
    await service.verifyAndCredit('payment-reference', {
      role: 'CUSTOMER',
      customerId: 'customer-owner',
    });
    expect((service as any).handleWebhook).toHaveBeenCalledWith({
      event: 'charge.success',
      data: { status: 'success', metadata: { customerId: 'customer-owner' } },
    });
  });


  it('treats Paystack HTTP 5xx responses as temporary outages', async () => {
    const service = new PaystackService({} as any);
    (service as any).getSecretKey = jest.fn().mockReturnValue('test-secret');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ message: 'Paystack temporarily unavailable' }),
    } as Response);

    try {
      await expect((service as any).request('/charge')).rejects.toBeInstanceOf(BadGatewayException);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('allows authorized staff roles to verify a successful payment', async () => {
    const service = createService('customer-owner');
    await service.verifyAndCredit('payment-reference', { role: 'ADMIN' });
    expect((service as any).handleWebhook).toHaveBeenCalledTimes(1);
  });
});

describe('Paystack staff identity webhook reconciliation', () => {
  it('marks a matching staff verification failed from the central webhook', async () => {
    const prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'verification-1' }]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    const service = new PaystackService(prisma as any);

    const result = await service.handleStaffBvnVerificationWebhook({
      event: 'customeridentification.failed',
      data: { customer_code: 'CUS_test_staff', reason: 'Account number or BVN is incorrect' },
    });

    expect(result).toMatchObject({ ok: true, processed: true, reference: 'CUS_test_staff', status: 'FAILED' });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE "StaffBvnVerification"'),
      null, null, null, null, 'FAILED', 'Account number or BVN is incorrect', 'CUS_test_staff',
    );
  });

  it('ignores identity events that do not match staff onboarding', async () => {
    const prisma = { $queryRawUnsafe: jest.fn().mockResolvedValue([]), $executeRawUnsafe: jest.fn() };
    const service = new PaystackService(prisma as any);

    await expect(service.handleStaffBvnVerificationWebhook({
      event: 'customeridentification.success',
      data: { customer_code: 'CUS_regular_customer' },
    })).resolves.toMatchObject({ ok: true, ignored: true, reason: 'no-matching-staff-verification' });
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});


describe('Paystack wallet deposit currency validation', () => {
  it('rejects a successful payment in a non-NGN currency before touching the wallet', async () => {
    const service = new PaystackService({} as any);
    await expect((service as any).handleWebhook({
      event: 'charge.success',
      data: {
        status: 'success',
        currency: 'USD',
        amount: 10000,
        reference: 'foreign-currency-ref',
        id: 12345,
        metadata: { customerId: 'customer-1' },
      },
    })).rejects.toThrow('Only NGN Paystack wallet payments can be credited');
  });

  it('rejects a successful payment when currency is missing', async () => {
    const service = new PaystackService({} as any);
    await expect((service as any).handleWebhook({
      event: 'charge.success',
      data: {
        status: 'success',
        amount: 10000,
        reference: 'missing-currency-ref',
        id: 12346,
        metadata: { customerId: 'customer-1' },
      },
    })).rejects.toThrow('Only NGN Paystack wallet payments can be credited');
  });
});

describe('Paystack transfer webhook concurrency protection', () => {
  const failedTransferEvent = {
    event: 'transfer.failed',
    data: { reference: 'PWFB-WITHDRAWAL-001', id: 991, reason: 'Bank rejected transfer' },
  };

  function createTransferHarness(options?: { transactionStatus?: string; walletBalance?: number }) {
    const withdrawal = {
      id: 'withdrawal-1',
      reference: 'PWFB-WITHDRAWAL-001',
      customerId: 'customer-1',
      type: 'WITHDRAWAL',
      status: options?.transactionStatus || 'PENDING',
      amount: 100,
      previousBalance: 150,
      newBalance: 50,
      providerReference: null,
    };
    const wallet = {
      id: 'wallet-1',
      customerId: 'customer-1',
      balance: options?.walletBalance ?? 50,
      status: 'ACTIVE',
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(withdrawal),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...withdrawal, ...data })),
      },
      customerWallet: {
        findUnique: jest.fn().mockResolvedValue(wallet),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...wallet, ...data })),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    return { service: new PaystackService(prisma as any), prisma, tx, withdrawal, wallet };
  }

  it('locks the transfer reference before reading the transaction and locks the wallet row before refunding', async () => {
    const { service, tx } = createTransferHarness();
    const result = await service.handleWebhook(failedTransferEvent);

    expect(result).toMatchObject({ ok: true, processed: true, action: 'FAILED' });
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'PAYSTACK-TRANSFER:PWFB-WITHDRAWAL-001',
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
    expect(Number(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(150);
    expect(tx.walletTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'withdrawal-1' },
      data: expect.objectContaining({ status: 'FAILED', newBalance: expect.anything() }),
    }));
    expect(Number(tx.walletTransaction.update.mock.calls[0][0].data.newBalance)).toBe(150);
  });

  it('does not refund an already failed withdrawal again', async () => {
    const { service, tx } = createTransferHarness({ transactionStatus: 'FAILED' });
    await expect(service.handleWebhook(failedTransferEvent)).resolves.toMatchObject({
      ok: true,
      processed: false,
      duplicate: true,
    });
    expect(tx.customerWallet.findUnique).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
  });
});

describe('Paystack transfer webhook conflicting status events', () => {
  function setup(status: string) {
    const transaction = {
      id: 'withdrawal-2',
      reference: 'PWFB-WITHDRAWAL-002',
      customerId: 'customer-1',
      type: 'WITHDRAWAL',
      status,
      amount: 250,
      providerReference: '991',
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue(transaction),
        update: jest.fn().mockResolvedValue({ ...transaction, status: 'COMPLETED' }),
      },
      customerWallet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-2', customerId: 'customer-1', balance: 500, status: 'ACTIVE' }),
        update: jest.fn(),
      },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    return { service: new PaystackService(prisma as any), tx, transaction };
  }

  it('does not mark a previously refunded withdrawal completed after a late success event', async () => {
    const { service, tx, transaction } = setup('FAILED');
    await expect(service.handleWebhook({
      event: 'transfer.success',
      data: { reference: transaction.reference, id: 991 },
    })).resolves.toMatchObject({ ok: true, processed: false, conflict: true });
    expect(tx.walletTransaction.update).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
  });

  it('does not refund a completed withdrawal on a contradictory transfer.failed event', async () => {
    const { service, tx, transaction } = setup('COMPLETED');
    await expect(service.handleWebhook({
      event: 'transfer.failed',
      data: { reference: transaction.reference, id: 991 },
    })).resolves.toMatchObject({ ok: true, processed: false, conflict: true });
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.update).not.toHaveBeenCalled();
  });
});


describe('Paystack wallet deposit balance concurrency protection', () => {
  it('locks and re-reads the shared wallet balance before crediting a successful payment', async () => {
    const payment = {
      id: 98765,
      reference: 'paystack-checkout-100',
      status: 'success',
      currency: 'NGN',
      amount: 10000,
      metadata: { customerId: 'customer-1' },
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'wallet-transaction-1', ...data })),
      },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          customerId: 'customer-1',
          balance: 50.25,
          status: 'ACTIVE',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          customerId: 'customer-1',
          balance: 80.25,
          status: 'ACTIVE',
        }),
        update: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          customerId: 'customer-1',
          balance: 180.25,
          status: 'ACTIVE',
        }),
      },
    };
    const prisma = {
      walletTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new PaystackService(prisma as any);

    const result = await service.handleWebhook({ event: 'charge.success', data: payment });

    expect(result).toMatchObject({ ok: true, processed: true });
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      '98765',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'wallet-1',
    );
    expect(tx.customerWallet.findUnique).toHaveBeenCalledWith({ where: { id: 'wallet-1' } });
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: expect.anything() },
    });
    expect(Number(tx.customerWallet.update.mock.calls[0][0].data.balance)).toBe(180.25);
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        type: 'DEPOSIT',
        amount: expect.anything(),
        previousBalance: expect.anything(),
        newBalance: expect.anything(),
        reference: 'PAY-paystack-checkout-100',
        providerReference: '98765',
        status: 'COMPLETED',
      }),
    });
  });

  it('rejects a wallet that is inactive after its row is locked', async () => {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      walletTransaction: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 10, status: 'ACTIVE' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 10, status: 'SUSPENDED' }),
        update: jest.fn(),
      },
    };
    const prisma = {
      walletTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new PaystackService(prisma as any);

    await expect(service.handleWebhook({
      event: 'charge.success',
      data: {
        id: 98766,
        reference: 'paystack-checkout-101',
        status: 'success',
        currency: 'NGN',
        amount: 5000,
        metadata: { customerId: 'customer-1' },
      },
    })).rejects.toThrow('Customer wallet is not active');

    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });
});
