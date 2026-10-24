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
