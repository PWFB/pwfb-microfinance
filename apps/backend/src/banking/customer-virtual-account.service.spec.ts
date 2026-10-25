import { CustomerVirtualAccountService } from './customer-virtual-account.service';

describe('CustomerVirtualAccountService', () => {
  let service: CustomerVirtualAccountService;
  let prisma: any;

  const customer = {
    id: 'TEST-CUSTOMER-001',
    branchId: 'TEST-BRANCH-001',
    firstName: 'Test',
    middleName: null,
    lastName: 'Customer',
    email: 'test.customer@example.invalid',
    phone: '08000000000',
    user: { email: 'test.customer@example.invalid' },
  };

  const activeAccount = {
    id: 'local-va-001',
    customerId: customer.id,
    branchId: customer.branchId,
    institutionId: 'paystack',
    institutionName: 'Paystack',
    institutionShortName: 'Paystack',
    accountNumber: '9990001112',
    accountName: 'Paystack Business / Test Customer',
    provider: 'PAYSTACK',
    providerCustomerId: 'CUS_test',
    providerReference: '12345',
    providerBankName: 'Paystack-Titan',
    brandName: 'PWFB Microfinance',
    status: 'ACTIVE',
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    assignedAt: new Date('2026-01-01T00:01:00Z'),
    failureReason: null,
  };

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      bankInstitution: {
        upsert: jest.fn().mockResolvedValue({ id: 'paystack', name: 'Paystack', active: true }),
        findFirst: jest.fn(),
      },
      customerVirtualAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }: any) => data),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      customerBankAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'bank-account-001' }),
        update: jest.fn().mockResolvedValue({ id: 'bank-account-001' }),
      },
      staff: { findUnique: jest.fn() },
      staffVirtualAccount: { findUnique: jest.fn(), updateMany: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([activeAccount]),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    };
    service = new CustomerVirtualAccountService(prisma);
  });

  it('submits customer BVN and verified bank details to Paystack only after explicit consent', async () => {
    const originalSecret = process.env.PAYSTACK_SECRET_KEY;
    const testBvn = '1'.repeat(11);
    const testAccountNumber = '9'.repeat(10);
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_unit';
    const local = {
      id: 'local-va-kyc',
      customerId: customer.id,
      status: 'PENDING',
      consentAt: new Date(),
      providerCustomerId: 'CUS_test',
      failureReason: null,
    };
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce(local);
    prisma.bankInstitution.findFirst.mockResolvedValueOnce({ id: 'bank-057', code: '057', name: 'Zenith Bank' });
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (_url: any, init: any) => ({
      ok: true,
      status: 200,
      json: async () => init?.method === 'POST'
        ? { status: true, message: 'Identity verification accepted', data: {} }
        : { status: true, message: 'Account resolved', data: { account_name: 'Test Customer' } },
    } as Response));

    try {
      const result = await service.startIdentityVerification(customer.id, {
        bvn: testBvn,
        bankCode: '057',
        accountNumber: testAccountNumber,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(prisma.customerBankAccount.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ customerId: customer.id, institutionId: 'bank-057', accountNumber: testAccountNumber, verifiedAt: expect.any(Date) }),
      }));
      expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO customer_identity_verifications'),
        expect.any(String),
        customer.id,
        testBvn,
      );
      expect(prisma.customerVirtualAccount.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: local.id, status: 'PENDING' }),
      }));
      expect(result).toHaveLength(1);
    } finally {
      fetchSpy.mockRestore();
      if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
      else process.env.PAYSTACK_SECRET_KEY = originalSecret;
    }
  });

  it('requires explicit consent before starting customer identity verification', async () => {
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce(null);
    await expect(service.startIdentityVerification(customer.id, {
      bvn: '1'.repeat(11), bankCode: '057', accountNumber: '9'.repeat(10),
    })).rejects.toThrow('consent');
    expect(prisma.customerBankAccount.create).not.toHaveBeenCalled();
  });

  it('returns the existing active Paystack DVA without creating a duplicate', async () => {
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce({
      id: activeAccount.id,
      customerId: customer.id,
      status: 'ACTIVE',
      accountNumber: activeAccount.accountNumber,
      provider: 'PAYSTACK',
    });

    const result = await service.ensure(customer.id);

    expect(prisma.customerVirtualAccount.create).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].brandName).toBe('PWFB Microfinance');
    expect(result[0].accountNumber).toBe(activeAccount.accountNumber);
  });

  it('requires explicit customer consent before first-time assignment', async () => {
    prisma.customerVirtualAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(service.ensure(customer.id)).rejects.toThrow('consent');
    expect(prisma.customerVirtualAccount.create).not.toHaveBeenCalled();
  });

  it('requires explicit consent before resuming a pending assignment without a consent record', async () => {
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce({
      id: 'pending-va-without-consent',
      customerId: customer.id,
      status: 'PENDING',
      providerCustomerId: 'CUS_test',
      consentAt: null,
    });

    await expect(service.ensure(customer.id)).rejects.toThrow('consent');
    expect(prisma.customerVirtualAccount.update).not.toHaveBeenCalled();
  });

  it('persists explicit consent before returning a pending assignment with a provider customer code', async () => {
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce({
      id: 'pending-va-without-consent',
      customerId: customer.id,
      status: 'PENDING',
      providerCustomerId: 'CUS_test',
      consentAt: null,
    });

    await service.ensure(customer.id, undefined, true);

    expect(prisma.customerVirtualAccount.update).toHaveBeenCalledWith({
      where: { id: 'pending-va-without-consent' },
      data: { consentAt: expect.any(Date) },
    });
  });

  it('keeps a consented DVA request pending while customer KYC details are not verified yet', async () => {
    prisma.customerVirtualAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.customerVirtualAccount.create.mockResolvedValue({
      id: 'pending-va-001',
      customerId: customer.id,
      consentAt: new Date(),
      status: 'PENDING',
      providerCustomerId: null,
    });
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await service.ensure(customer.id, undefined, true);

    expect(prisma.customerVirtualAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pending-va-001' },
      data: expect.objectContaining({
        status: 'PENDING',
        failureReason: expect.stringContaining('Awaiting verified customer BVN'),
      }),
    }));
  });

  it('rejects provisioning for a customer that does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.ensure('missing-customer', undefined, true)).rejects.toThrow('Customer not found');
    expect(prisma.customerVirtualAccount.create).not.toHaveBeenCalled();
  });
});

describe('CustomerVirtualAccountService dedicated-account deposits', () => {
  const payment = {
    event: 'charge.success',
    data: {
      id: 98765,
      reference: 'ps_dva_test_01',
      status: 'success',
      currency: 'NGN',
      amount: 12550,
      authorization: {
        channel: 'dedicated_nuban',
        receiver_bank_account_number: '0123456789',
      },
    },
  };

  function createDepositHarness(options?: { account?: any; duplicate?: any; walletStatus?: string }) {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      customerWallet: {
        upsert: jest.fn().mockResolvedValue({
          id: 'wallet-1',
          customerId: 'customer-1',
          balance: 100.75,
          status: options?.walletStatus || 'ACTIVE',
        }),
        update: jest.fn().mockResolvedValue({ id: 'wallet-1', balance: 226.25, status: 'ACTIVE' }),
      },
      walletTransaction: {
        findFirst: jest.fn().mockResolvedValue(options?.duplicate || null),
        create: jest.fn().mockResolvedValue({ id: 'txn-1', reference: 'PAYSTACK-DVA-ps_dva_test_01' }),
      },
    };
    const prismaForDeposit = {
      customerVirtualAccount: {
        findFirst: jest.fn().mockResolvedValue(options?.account === undefined ? {
          id: 'cva-1',
          customerId: 'customer-1',
          branchId: 'branch-1',
        } : options.account),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    return {
      service: new CustomerVirtualAccountService(prismaForDeposit as any),
      prismaForDeposit,
      tx,
    };
  }

  it('credits an active customer wallet and records the payment once', async () => {
    const { service, prismaForDeposit, tx } = createDepositHarness();
    const result = await service.handleDedicatedDepositWebhook(payment);

    expect(result).toMatchObject({ ok: true, processed: true, matchedCustomerAccount: true });
    expect(prismaForDeposit.customerVirtualAccount.findFirst).toHaveBeenCalledWith({
      where: { provider: 'PAYSTACK', accountNumber: '0123456789', status: 'ACTIVE' },
      select: { id: true, customerId: true, branchId: true },
    });
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      '98765',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'wallet-1' },
      data: { balance: 226.25 },
    });
    expect(tx.walletTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerId: 'customer-1',
        type: 'DEPOSIT',
        amount: 125.5,
        previousBalance: 100.75,
        newBalance: 226.25,
        reference: 'PAYSTACK-DVA-ps_dva_test_01',
        provider: 'PAYSTACK',
        providerReference: 'PAYSTACK-DVA-98765',
        status: 'COMPLETED',
      }),
    });
  });

  it('leaves unmapped dedicated accounts for the branch ledger handler', async () => {
    const { service, prismaForDeposit } = createDepositHarness({ account: null });
    await expect(service.handleDedicatedDepositWebhook(payment)).resolves.toMatchObject({
      ok: true,
      processed: false,
      matchedCustomerAccount: false,
    });
    expect(prismaForDeposit.$transaction).not.toHaveBeenCalled();
  });

  it('does not credit duplicate provider events twice', async () => {
    const { service, tx } = createDepositHarness({
      duplicate: { id: 'existing-txn', reference: 'PAYSTACK-DVA-ps_dva_test_01' },
    });
    await expect(service.handleDedicatedDepositWebhook(payment)).resolves.toMatchObject({
      ok: true,
      processed: false,
      duplicate: true,
      matchedCustomerAccount: true,
    });
    expect(tx.customerWallet.update).not.toHaveBeenCalled();
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('rejects foreign or missing currency for a mapped customer account', async () => {
    const { service } = createDepositHarness();
    await expect(service.handleDedicatedDepositWebhook({
      ...payment,
      data: { ...payment.data, currency: 'USD' },
    })).rejects.toThrow('Only NGN Paystack virtual-account deposits can be credited');
    await expect(service.handleDedicatedDepositWebhook({
      ...payment,
      data: { ...payment.data, currency: undefined },
    })).rejects.toThrow('Only NGN Paystack virtual-account deposits can be credited');
  });

  it('rejects an inactive customer wallet without recording a deposit', async () => {
    const { service, tx } = createDepositHarness({ walletStatus: 'SUSPENDED' });
    await expect(service.handleDedicatedDepositWebhook(payment)).rejects.toThrow('Customer wallet is not active');
    expect(tx.walletTransaction.create).not.toHaveBeenCalled();
  });

  it('ignores unrelated events and payment channels', async () => {
    const { service, prismaForDeposit } = createDepositHarness();
    await expect(service.handleDedicatedDepositWebhook({
      event: 'charge.failed',
      data: payment.data,
    })).resolves.toMatchObject({ matchedCustomerAccount: false, processed: false });
    await expect(service.handleDedicatedDepositWebhook({
      ...payment,
      data: { ...payment.data, authorization: { channel: 'card' } },
    })).resolves.toMatchObject({ matchedCustomerAccount: false, processed: false });
    expect(prismaForDeposit.customerVirtualAccount.findFirst).not.toHaveBeenCalled();
  });
});
