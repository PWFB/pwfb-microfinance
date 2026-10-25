import { BadRequestException } from '@nestjs/common';
import { PaystackBranchDvaService } from './paystack-branch-dva.service';

describe('PaystackBranchDvaService deposit reconciliation', () => {
  const payment = {
    event: 'charge.success',
    data: {
      id: 98765,
      reference: 'ps_branch_dva_test_01',
      status: 'success',
      currency: 'NGN',
      amount: 12550,
      authorization: {
        channel: 'dedicated_nuban',
        receiver_bank_account_number: '0123456789',
        sender_name: 'Test Sender',
      },
    },
  };

  function createHarness(options?: { account?: any; duplicate?: any }) {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      cashbookEntry: {
        findFirst: jest.fn().mockResolvedValue(options?.duplicate || null),
        create: jest.fn().mockResolvedValue({ id: 'cashbook-1' }),
      },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'open-period-1' }),
      },
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue(options?.account === undefined ? [{
        branchId: 'branch-1',
        status: 'ACTIVE',
      }] : options.account),
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    return { service: new PaystackBranchDvaService(prisma as any), prisma, tx };
  }

  it('records a successful NGN deposit once in the cashbook', async () => {
    const { service, tx } = createHarness();
    const result = await service.handleWebhook(payment);

    expect(result).toMatchObject({
      ok: true,
      processed: true,
      entryId: 'cashbook-1',
      branchId: 'branch-1',
      amount: 125.5,
      reference: 'PAYSTACK-DVA-98765',
    });
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'PAYSTACK-BRANCH-DVA:98765',
    );
    expect(tx.cashbookEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        periodId: 'open-period-1',
        branchId: 'branch-1',
        type: 'CASH_IN',
        amount: 125.5,
        reference: 'PAYSTACK-DVA-98765',
      }),
    });
  });

  it('rejects foreign or missing currency before ledger writes', async () => {
    const { service, prisma } = createHarness();
    await expect(service.handleWebhook({
      ...payment,
      data: { ...payment.data, currency: 'USD' },
    })).rejects.toThrow('Only NGN Paystack branch virtual-account deposits can be recorded');
    await expect(service.handleWebhook({
      ...payment,
      data: { ...payment.data, currency: undefined },
    })).rejects.toThrow('Only NGN Paystack branch virtual-account deposits can be recorded');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create a cashbook entry when the provider payment was already processed', async () => {
    const { service, tx } = createHarness({
      duplicate: { id: 'existing-entry', reference: 'PAYSTACK-DVA-98765' },
    });
    await expect(service.handleWebhook(payment)).resolves.toMatchObject({
      ok: true,
      processed: false,
      duplicate: true,
    });
    expect(tx.cashbookEntry.create).not.toHaveBeenCalled();
    expect(tx.financialPeriod.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a deposit with no provider reference instead of using the account number as a reference', async () => {
    const { service, prisma } = createHarness();
    await expect(service.handleWebhook({
      ...payment,
      data: { ...payment.data, id: undefined, reference: undefined },
    })).rejects.toThrow('Paystack branch deposit is missing a payment reference');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('does not record a charge.success payload unless the payment status is success', async () => {
    const { service, prisma } = createHarness();
    await expect(service.handleWebhook({
      ...payment,
      data: { ...payment.data, status: 'pending' },
    })).resolves.toMatchObject({ ok: true, processed: false });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not create branch ledger entries for unmapped accounts', async () => {
    const { service, prisma } = createHarness({ account: [] });
    await expect(service.handleWebhook(payment)).resolves.toMatchObject({
      ok: true,
      processed: false,
      message: 'Dedicated account is not mapped to a PWFB branch',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
