import { CustomerVirtualAccountService } from './customer-virtual-account.service';

describe('CustomerVirtualAccountService', () => {
  let service: CustomerVirtualAccountService;
  let prisma: any;
  let flutterwave: any;

  const customer = {
    id: 'TEST-CUSTOMER-001',
    branchId: 'TEST-BRANCH-001',
    firstName: 'Test',
    lastName: 'Customer',
    email: 'test.customer@example.invalid',
    phone: '08000000000',
    user: { email: 'test.customer@example.invalid' },
  };

  beforeEach(() => {
    prisma = {
      customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      bankInstitution: { findFirst: jest.fn() },
      customerVirtualAccount: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockImplementation(async ({ data }: any) => data),
      },
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 'local-va-001',
        customerId: customer.id,
        branchId: customer.branchId,
        institutionId: null,
        institutionName: null,
        institutionShortName: null,
        accountNumber: '9990001112',
        accountName: 'Test Customer',
        provider: 'FLUTTERWAVE',
        providerCustomerId: 'flw-customer-001',
        providerReference: 'pwfb-va-TEST-CUSTOMER-001-local-va-001',
        status: 'ACTIVE',
        requestedAt: new Date('2026-01-01T00:00:00Z'),
        assignedAt: new Date('2026-01-01T00:01:00Z'),
        failureReason: null,
      }]),
    };
    flutterwave = {
      createCustomer: jest.fn().mockResolvedValue({ id: 'flw-customer-001' }),
      createStaticVirtualAccount: jest.fn().mockResolvedValue({
        accountNumber: '9990001112',
        accountName: 'Test Customer',
        providerReference: 'pwfb-va-TEST-CUSTOMER-001-local-va-001',
      }),
    };
    service = new CustomerVirtualAccountService(prisma, flutterwave);
  });

  it('creates and persists a provider virtual account for a customer', async () => {
    prisma.customerVirtualAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.customerVirtualAccount.create.mockResolvedValue({
      id: 'local-va-001',
      customerId: customer.id,
      providerCustomerId: null,
      institutionId: null,
      branchId: customer.branchId,
      status: 'PENDING',
    });

    const result = await service.ensure(customer.id);

    expect(flutterwave.createCustomer).toHaveBeenCalledWith({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
    });
    expect(flutterwave.createStaticVirtualAccount).toHaveBeenCalledWith({
      customerId: 'flw-customer-001',
      reference: 'pwfb-va-TEST-CUSTOMER-001-local-va-001',
      narration: 'Test Customer',
    });
    expect(prisma.customerVirtualAccount.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'local-va-001' },
      data: expect.objectContaining({ status: 'ACTIVE', accountNumber: '9990001112' }),
    }));
    expect(result[0].status).toBe('ACTIVE');
  });

  it('does not provision another provider account when an active account already exists', async () => {
    prisma.customerVirtualAccount.findFirst.mockResolvedValueOnce({
      id: 'local-va-001',
      customerId: customer.id,
      status: 'ACTIVE',
      accountNumber: '9990001112',
    });

    const result = await service.ensure(customer.id);

    expect(flutterwave.createCustomer).not.toHaveBeenCalled();
    expect(flutterwave.createStaticVirtualAccount).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('reuses the failed record and provider customer ID on retry', async () => {
    prisma.customerVirtualAccount.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'local-va-001',
        customerId: customer.id,
        providerCustomerId: 'flw-customer-existing',
        institutionId: null,
        branchId: customer.branchId,
        status: 'FAILED',
      });

    await service.ensure(customer.id);

    expect(prisma.customerVirtualAccount.create).not.toHaveBeenCalled();
    expect(flutterwave.createCustomer).not.toHaveBeenCalled();
    expect(flutterwave.createStaticVirtualAccount).toHaveBeenCalledWith({
      customerId: 'flw-customer-existing',
      reference: 'pwfb-va-TEST-CUSTOMER-001-local-va-001',
      narration: 'Test Customer',
    });
  });

  it('rejects provisioning when the customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);
    await expect(service.ensure('missing-customer')).rejects.toThrow('Customer not found');
    expect(flutterwave.createCustomer).not.toHaveBeenCalled();
  });

  it('rejects an inactive requested institution', async () => {
    prisma.bankInstitution.findFirst.mockResolvedValue({ id: 'bank-1', active: false });
    await expect(service.ensure(customer.id, 'bank-1')).rejects.toThrow('inactive');
    expect(flutterwave.createCustomer).not.toHaveBeenCalled();
  });
});
