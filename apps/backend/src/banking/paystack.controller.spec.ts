import { UnauthorizedException } from '@nestjs/common';
import { PaystackController } from './paystack.controller';

describe('PaystackController central webhook authentication and routing', () => {
  function createHarness(signatureValid = true, customerDepositMatch = false) {
    const paystackService = {
      verifyWebhookSignature: jest.fn().mockReturnValue(signatureValid),
      handleStaffBvnVerificationWebhook: jest.fn().mockResolvedValue({ ok: true, ignored: true }),
      handleWebhook: jest.fn().mockResolvedValue({ ok: true, processed: true }),
    };
    const branchDvaService = {
      handleWebhook: jest.fn().mockResolvedValue({ ok: true, processed: true, branch: true }),
    };
    const customerVirtualAccountService = {
      handleAssignmentWebhook: jest.fn().mockResolvedValue({ ok: true, processed: true }),
      handleDedicatedDepositWebhook: jest.fn().mockResolvedValue({
        ok: true,
        processed: customerDepositMatch,
        matchedCustomerAccount: customerDepositMatch,
      }),
    };
    const controller = new PaystackController(
      paystackService as any,
      branchDvaService as any,
      customerVirtualAccountService as any,
    );
    return { controller, paystackService, branchDvaService, customerVirtualAccountService };
  }

  const request = () => ({ rawBody: Buffer.from('{"event":"charge.success"}') });

  it('rejects an invalid signature before any payment or virtual-account handler runs', async () => {
    const { controller, paystackService, branchDvaService, customerVirtualAccountService } = createHarness(false);
    await expect(controller.webhook('bad-signature', request(), { event: 'charge.success' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(paystackService.handleWebhook).not.toHaveBeenCalled();
    expect(paystackService.handleStaffBvnVerificationWebhook).not.toHaveBeenCalled();
    expect(branchDvaService.handleWebhook).not.toHaveBeenCalled();
    expect(customerVirtualAccountService.handleAssignmentWebhook).not.toHaveBeenCalled();
    expect(customerVirtualAccountService.handleDedicatedDepositWebhook).not.toHaveBeenCalled();
  });

  it('rejects a request when the raw body required for signature verification is missing', async () => {
    const { controller, paystackService } = createHarness(true);
    await expect(controller.webhook('some-signature', {}, { event: 'charge.success' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(paystackService.verifyWebhookSignature).not.toHaveBeenCalled();
    expect(paystackService.handleWebhook).not.toHaveBeenCalled();
  });

  it('routes a matched customer dedicated-account deposit to customer wallet reconciliation', async () => {
    const { controller, paystackService, branchDvaService, customerVirtualAccountService } = createHarness(true, true);
    const result = await controller.webhook('valid-signature', request(), {
      event: 'charge.success',
      data: { status: 'success', authorization: { channel: 'dedicated_nuban' } },
    });
    expect(result).toMatchObject({ matchedCustomerAccount: true, processed: true });
    expect(paystackService.verifyWebhookSignature).toHaveBeenCalledWith(request().rawBody, 'valid-signature');
    expect(customerVirtualAccountService.handleDedicatedDepositWebhook).toHaveBeenCalledTimes(1);
    expect(branchDvaService.handleWebhook).not.toHaveBeenCalled();
    expect(paystackService.handleWebhook).not.toHaveBeenCalled();
  });

  it('falls back to the branch ledger for a dedicated account not mapped to a customer', async () => {
    const { controller, branchDvaService, customerVirtualAccountService } = createHarness(true, false);
    const result = await controller.webhook('valid-signature', request(), {
      event: 'charge.success',
      data: { status: 'success', authorization: { channel: 'dedicated_nuban' } },
    });
    expect(result).toMatchObject({ ok: true, processed: true, branch: true });
    expect(customerVirtualAccountService.handleDedicatedDepositWebhook).toHaveBeenCalledTimes(1);
    expect(branchDvaService.handleWebhook).toHaveBeenCalledTimes(1);
  });

  it('sends assignment webhooks to both customer/staff and branch reconciliation handlers', async () => {
    const { controller, branchDvaService, customerVirtualAccountService } = createHarness(true);
    const result = await controller.webhook('valid-signature', request(), {
      event: 'dedicatedaccount.assign.success',
      data: { customer_code: 'CUS_test', dedicated_account: { account_number: '0123456789' } },
    });
    expect(result).toMatchObject({ ok: true, event: 'dedicatedaccount.assign.success' });
    expect(customerVirtualAccountService.handleAssignmentWebhook).toHaveBeenCalledTimes(1);
    expect(branchDvaService.handleWebhook).toHaveBeenCalledTimes(1);
  });

  it('routes ordinary Paystack card/checkout payments to the wallet handler', async () => {
    const { controller, paystackService, branchDvaService, customerVirtualAccountService } = createHarness(true);
    const result = await controller.webhook('valid-signature', request(), {
      event: 'charge.success',
      data: { status: 'success', currency: 'NGN', reference: 'PAY-test', metadata: { customerId: 'customer-1' }, authorization: { channel: 'card' } },
    });
    expect(result).toMatchObject({ ok: true, processed: true });
    expect(paystackService.handleWebhook).toHaveBeenCalledTimes(1);
    expect(customerVirtualAccountService.handleDedicatedDepositWebhook).not.toHaveBeenCalled();
    expect(branchDvaService.handleWebhook).not.toHaveBeenCalled();
  });
});
