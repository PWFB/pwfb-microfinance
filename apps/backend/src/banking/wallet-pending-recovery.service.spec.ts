import { WalletPendingRecoveryService } from './wallet-pending-recovery.service';

describe('WalletPendingRecoveryService', () => {
  const makeService = () => {
    const prisma: any = { walletTransaction: { findMany: jest.fn() } };
    const paystack: any = { getTransactionVerification: jest.fn(), getTransferVerification: jest.fn(), handleWebhook: jest.fn(), reconcilePendingDeposit: jest.fn() };
    const flutterwave: any = { getTransferStatus: jest.fn() };
    const withdrawalWebhook: any = { applyVerifiedReconciliation: jest.fn() };
    const customerVirtualAccounts: any = { requeryDuePaystackAccounts: jest.fn().mockResolvedValue({ checked: 0, requested: 0, errors: 0 }) };
    const branchDva: any = { requeryDueAccounts: jest.fn().mockResolvedValue({ checked: 0, requested: 0, errors: 0 }) };
    const service = new WalletPendingRecoveryService(prisma, paystack, flutterwave, withdrawalWebhook, customerVirtualAccounts, branchDva);
    return { service, prisma, paystack, flutterwave, withdrawalWebhook, customerVirtualAccounts, branchDva };
  };

  it('does not query provider transactions until at least five minutes after creation', async () => {
    const { service, prisma } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    await service.recoverPendingTransactions();
    const after = Date.now();
    const query = prisma.walletTransaction.findMany.mock.calls[0][0];
    expect(query.where.createdAt.lt.getTime()).toBeLessThanOrEqual(after - 5 * 60_000);
  });

  it('leaves a Paystack deposit pending while the provider is still processing', async () => {
    const { service, prisma, paystack } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w1', type: 'DEPOSIT', status: 'PENDING', provider: 'PAYSTACK', reference: 'PAY-ref-1', providerReference: 'ref-1', amount: 100 },
    ]);
    paystack.getTransactionVerification.mockResolvedValue({ reference: 'ref-1', status: 'ongoing', amount: 10000, currency: 'NGN' });
    const result = await service.recoverPendingTransactions();
    expect(result.stillPending).toBe(1);
    expect(paystack.handleWebhook).not.toHaveBeenCalled();
    expect(paystack.reconcilePendingDeposit).not.toHaveBeenCalled();
  });

  it('credits only after Paystack reports success and uses the idempotent webhook handler', async () => {
    const { service, prisma, paystack } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w1', type: 'DEPOSIT', status: 'PENDING', provider: 'PAYSTACK', reference: 'PAY-ref-1', providerReference: 'ref-1', amount: 100 },
    ]);
    paystack.getTransactionVerification.mockResolvedValue({ reference: 'ref-1', status: 'success', amount: 10000, currency: 'NGN', customer: { id: 1 } });
    paystack.handleWebhook.mockResolvedValue({ processed: true });
    const result = await service.recoverPendingTransactions();
    expect(result.completed).toBe(1);
    expect(paystack.handleWebhook).toHaveBeenCalledWith({ event: 'charge.success', data: expect.objectContaining({ reference: 'ref-1' }) });
  });

  it('marks a verified abandoned Paystack deposit failed without crediting it', async () => {
    const { service, prisma, paystack } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w1', type: 'DEPOSIT', status: 'PENDING', provider: 'PAYSTACK', reference: 'PAY-ref-1', providerReference: 'ref-1' },
    ]);
    paystack.getTransactionVerification.mockResolvedValue({ reference: 'ref-1', status: 'abandoned', amount: 10000, currency: 'NGN' });
    paystack.reconcilePendingDeposit.mockResolvedValue({ processed: true });
    const result = await service.recoverPendingTransactions();
    expect(result.failed).toBe(1);
    expect(paystack.reconcilePendingDeposit).toHaveBeenCalledWith('ref-1', 'FAILED', expect.any(String));
    expect(paystack.handleWebhook).not.toHaveBeenCalled();
  });

  it('leaves a Flutterwave withdrawal pending when the provider reports pending', async () => {
    const { service, prisma, flutterwave, withdrawalWebhook } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w2', type: 'WITHDRAWAL', status: 'PENDING', provider: 'FLUTTERWAVE', reference: 'FLW-1', providerReference: '123', amount: 100 },
    ]);
    flutterwave.getTransferStatus.mockResolvedValue({ data: { id: '123', reference: 'FLW-1', status: 'PENDING', amount: 100, currency: 'NGN' } });
    const result = await service.recoverPendingTransactions();
    expect(result.stillPending).toBe(1);
    expect(withdrawalWebhook.applyVerifiedReconciliation).not.toHaveBeenCalled();
  });

  it('does not initiate recovery for unsupported NIBSS transactions', async () => {
    const { service, prisma, paystack, flutterwave } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w3', type: 'WITHDRAWAL', status: 'PENDING', provider: 'NIBSS', reference: 'NIP-1', providerReference: 'NIP-1' },
    ]);
    await service.recoverPendingTransactions();
    expect(paystack.getTransferVerification).not.toHaveBeenCalled();
    expect(flutterwave.getTransferStatus).not.toHaveBeenCalled();
  });
  it('marks a verified successful Paystack withdrawal complete without refunding it', async () => {
    const { service, prisma, paystack } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w4', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK', reference: 'PAY-out-1', providerReference: '702', amount: 100 },
    ]);
    paystack.getTransferVerification.mockResolvedValue({ reference: 'PAY-out-1', status: 'success', amount: 10000, currency: 'NGN', id: 702 });
    paystack.handleWebhook.mockResolvedValue({ processed: true, action: 'COMPLETED' });
    const result = await service.recoverPendingTransactions();
    expect(result.completed).toBe(1);
    expect(paystack.handleWebhook).toHaveBeenCalledWith({ event: 'transfer.success', data: expect.objectContaining({ reference: 'PAY-out-1' }) });
  });

  it('restores a Paystack withdrawal only after verified failed status', async () => {
    const { service, prisma, paystack } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w5', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'PAYSTACK', reference: 'PAY-out-2', providerReference: '703', amount: 100 },
    ]);
    paystack.getTransferVerification.mockResolvedValue({ reference: 'PAY-out-2', status: 'failed', amount: 10000, currency: 'NGN', id: 703 });
    paystack.handleWebhook.mockResolvedValue({ processed: true, action: 'FAILED' });
    const result = await service.recoverPendingTransactions();
    expect(result.failed).toBe(1);
    expect(paystack.handleWebhook).toHaveBeenCalledWith({ event: 'transfer.failed', data: expect.objectContaining({ reference: 'PAY-out-2' }) });
  });

  it('does not refund a Flutterwave withdrawal whose reference or amount does not match', async () => {
    const { service, prisma, flutterwave, withdrawalWebhook } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([
      { id: 'w6', type: 'WITHDRAWAL', status: 'PROCESSING', provider: 'FLUTTERWAVE', reference: 'FLW-2', providerReference: '124', amount: 100 },
    ]);
    flutterwave.getTransferStatus.mockResolvedValue({ data: { id: '124', reference: 'FLW-2', status: 'FAILED', amount: 99, currency: 'NGN' } });
    const result = await service.recoverPendingTransactions();
    expect(result.stillPending).toBe(1);
    expect(withdrawalWebhook.applyVerifiedReconciliation).not.toHaveBeenCalled();
  });

  it('runs the ten-minute-cooldown DVA requery hook during each recovery pass', async () => {
    const { service, prisma, customerVirtualAccounts } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    customerVirtualAccounts.requeryDuePaystackAccounts.mockResolvedValue({ checked: 12, requested: 10, errors: 2 });
    const result = await service.recoverPendingTransactions();
    expect(customerVirtualAccounts.requeryDuePaystackAccounts).toHaveBeenCalledWith(50);
    expect(result.dvaAccountsChecked).toBe(12);
    expect(result.dvaRequeries).toBe(10);
    expect(result.dvaRequeryErrors).toBe(2);
  });

  it('requeries Paystack branch virtual accounts through the branch DVA cooldown', async () => {
    const { service, prisma, branchDva } = makeService();
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    branchDva.requeryDueAccounts.mockResolvedValue({ checked: 8, requested: 7, errors: 1 });
    const result = await service.recoverPendingTransactions();
    expect(branchDva.requeryDueAccounts).toHaveBeenCalledWith(50);
    expect(result.branchDvaAccountsChecked).toBe(8);
    expect(result.branchDvaRequeries).toBe(7);
    expect(result.branchDvaRequeryErrors).toBe(1);
  });

});