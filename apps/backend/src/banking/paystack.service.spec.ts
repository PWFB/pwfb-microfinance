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
