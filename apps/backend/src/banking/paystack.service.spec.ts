import { UnauthorizedException } from '@nestjs/common';
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

  it('allows authorized staff roles to verify a successful payment', async () => {
    const service = createService('customer-owner');
    await service.verifyAndCredit('payment-reference', { role: 'ADMIN' });
    expect((service as any).handleWebhook).toHaveBeenCalledTimes(1);
  });
});
