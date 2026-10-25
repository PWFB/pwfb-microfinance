import { BankingController } from './banking.controller';

describe('BankingController customer virtual-account consent forwarding', () => {
  it('forwards explicit consent to the DVA service', async () => {
    const customerVirtualAccountService = { ensure: jest.fn().mockResolvedValue([{ status: 'PENDING' }]) };
    const controller = new BankingController(
      {} as any,
      customerVirtualAccountService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await controller.ensureCustomerVirtualAccount(
      'customer-1',
      { institutionId: 'paystack', consentConfirmed: true },
      { user: { role: 'ADMIN' } },
    );

    expect(customerVirtualAccountService.ensure).toHaveBeenCalledWith('customer-1', 'paystack', true);
    expect(result).toEqual([{ status: 'PENDING' }]);
  });

  it('does not infer consent when the request omits confirmation', async () => {
    const customerVirtualAccountService = { ensure: jest.fn().mockResolvedValue([]) };
    const controller = new BankingController(
      {} as any,
      customerVirtualAccountService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await controller.ensureCustomerVirtualAccount(
      'customer-1',
      {},
      { user: { role: 'ADMIN' } },
    );

    expect(customerVirtualAccountService.ensure).toHaveBeenCalledWith('customer-1', undefined, false);
  });
});
