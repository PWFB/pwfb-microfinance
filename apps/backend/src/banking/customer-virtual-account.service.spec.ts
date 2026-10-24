import { createHmac } from 'node:crypto';
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
      staff: { findUnique: jest.fn() },
      staffVirtualAccount: { findUnique: jest.fn(), updateMany: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([activeAccount]),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new CustomerVirtualAccountService(prisma);
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

describe('CustomerVirtualAccountService Paystack webhook signature', () => {
  const service = Object.create(CustomerVirtualAccountService.prototype) as CustomerVirtualAccountService;
  const rawBody = Buffer.from('{"event":"dedicatedaccount.assign.success","data":{}}');
  const originalSecret = process.env.PAYSTACK_SECRET_KEY;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = originalSecret;
  });

  it('accepts a valid HMAC-SHA512 signature for the exact raw body', () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_webhook_test_key';
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it('rejects a tampered body or signature', () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_webhook_test_key';
    const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
    expect(service.verifyWebhookSignature(Buffer.from('{"event":"tampered"}'), signature)).toBe(false);
    expect(service.verifyWebhookSignature(rawBody, 'invalid')).toBe(false);
  });

  it('rejects a missing secret or signature', () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    expect(service.verifyWebhookSignature(rawBody, 'anything')).toBe(false);
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_webhook_test_key';
    expect(service.verifyWebhookSignature(rawBody)).toBe(false);
  });
});
