import { BadRequestException } from '@nestjs/common';
import { ExternalBankTransferService } from './external-bank-transfer.service';

describe('ExternalBankTransferService outbound bank transfer', () => {
  let service: ExternalBankTransferService;
  let prisma: any;
  let tx: any;
  let paystack: any;
  let currentTxWallet: any;
  let currentTxTransaction: any;

  beforeEach(() => {
    currentTxWallet = null;
    currentTxTransaction = null;
    tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      customerWallet: {
        findUnique: jest.fn().mockImplementation(async () => currentTxWallet ? { ...currentTxWallet } : null),
        updateMany: jest.fn().mockImplementation(async ({ where, data }: any) => {
          if (!currentTxWallet || currentTxWallet.id !== where.id || currentTxWallet.status !== where.status || currentTxWallet.balance < where.balance.gte) return { count: 0 };
          currentTxWallet = { ...currentTxWallet, ...data };
          return { count: 1 };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          currentTxWallet = { ...currentTxWallet, ...data };
          return { id: where.id, ...currentTxWallet };
        }),
      },
      walletTransaction: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          currentTxTransaction && currentTxTransaction.reference === where.reference
            ? { ...currentTxTransaction }
            : null,
        ),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          currentTxTransaction = { id: 'test-withdrawal', ...data };
          return { ...currentTxTransaction };
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          currentTxTransaction = { ...(currentTxTransaction || {}), ...data, reference: where.reference };
          return { id: 'test-withdrawal', ...currentTxTransaction };
        }),
      },
    };
    prisma = {
      customerWallet: { findUnique: jest.fn() },
      walletTransaction: {
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({ id: 'test-withdrawal', reference: where.reference, ...data })),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    paystack = {
      transferToBank: jest.fn(),
      resolveBankAccount: jest.fn(),
      listBanks: jest.fn(),
    };
    service = new ExternalBankTransferService(
      prisma,
      { transfer: jest.fn(), nameEnquiry: jest.fn() } as any,
      { transfer: jest.fn(), nameEnquiry: jest.fn(), listBanks: jest.fn() } as any,
      paystack as any,
    );
    jest.spyOn(service, 'nameEnquiry').mockResolvedValue({
      accountName: 'TEST BENEFICIARY',
      accountNumber: '1234567890',
      provider: 'PAYSTACK',
      verified: true,
    } as any);
    jest.spyOn(service, 'transferToVerifiedAccount').mockResolvedValue({
      status: 'SUCCESSFUL',
      providerReference: 'TEST-PROVIDER-REF-001',
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects malformed destination details and invalid amounts before provider verification', async () => {
    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '',
      accountNumber: '1234567890',
      amount: 100,
    })).rejects.toThrow(BadRequestException);

    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '123',
      amount: 100,
    })).rejects.toThrow(BadRequestException);

    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 0,
    })).rejects.toThrow(BadRequestException);

    expect(service.nameEnquiry).not.toHaveBeenCalled();
    expect(service.transferToVerifiedAccount).not.toHaveBeenCalled();
  });

  it('rejects insufficient balance before initiating an outbound provider transfer', async () => {
    const wallet = { id: 'TEST-WALLET-001', customerId: 'TEST-CUSTOMER-001', balance: 50, status: 'ACTIVE' };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;

    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 100,
      provider: 'PAYSTACK',
    })).rejects.toThrow('Insufficient wallet balance');

    expect(service.nameEnquiry).toHaveBeenCalled();
    expect(service.transferToVerifiedAccount).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('records an accepted provider transfer as a withdrawal and debits the wallet once', async () => {
    const wallet = {
      id: 'TEST-WALLET-001',
      customerId: 'TEST-CUSTOMER-001',
      balance: 1000,
      status: 'ACTIVE',
    };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;

    const result = await service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 250,
      description: 'TEST outbound bank transfer',
      provider: 'PAYSTACK',
    });

    expect(service.nameEnquiry).toHaveBeenCalledWith('058', '1234567890', 'PAYSTACK');
    expect(service.transferToVerifiedAccount).toHaveBeenCalledWith(expect.objectContaining({
      bankCode: '058',
      accountNumber: '1234567890',
      accountName: 'TEST BENEFICIARY',
      amount: 250,
      provider: 'PAYSTACK',
    }));
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
      'TEST-WALLET-001',
    );
    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 750 },
    }));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'TEST-CUSTOMER-001',
        type: 'WITHDRAWAL',
        amount: 250,
        previousBalance: 1000,
        newBalance: 750,
        provider: 'PAYSTACK',
        providerReference: expect.any(String),
        status: 'PROCESSING',
      }),
    }));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction.mock.calls[0][0]).toBeInstanceOf(Function);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.walletTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { reference: expect.any(String) },
      data: expect.objectContaining({
        status: 'COMPLETED',
        providerReference: 'TEST-PROVIDER-REF-001',
      }),
    }));
    expect(result.wallet.balance).toBe(750);
    expect(result.beneficiary).toMatchObject({
      accountNumber: '1234567890',
      accountName: 'TEST BENEFICIARY',
      verified: true,
      accountNameVerified: true,
    });
  });
  it('restores reserved funds when the provider definitively rejects a transfer', async () => {
    const wallet = { id: 'TEST-WALLET-001', customerId: 'TEST-CUSTOMER-001', balance: 1000, status: 'ACTIVE' };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;
    jest.spyOn(service, 'transferToVerifiedAccount').mockResolvedValue({ status: 'FAILED', providerReference: 'TEST-FAILED-REF' } as any);

    const result = await service.transfer({
      customerId: 'TEST-CUSTOMER-001', bankCode: '058', accountNumber: '1234567890',
      amount: 250, provider: 'PAYSTACK',
    });

    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 750 },
    }));
    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 1000 },
    }));
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      expect.stringMatching(/^WALLET-WITHDRAWAL:/),
    );
    expect(tx.walletTransaction.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { reference: expect.any(String) },
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
    expect(result.wallet.balance).toBe(1000);
  });

  it('does not refund again when a withdrawal webhook has already marked the payout failed', async () => {
    const wallet = { id: 'TEST-WALLET-001', customerId: 'TEST-CUSTOMER-001', balance: 1000, status: 'ACTIVE' };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;
    jest.spyOn(service, 'transferToVerifiedAccount').mockImplementation(async () => {
      // Simulate the central provider webhook winning the race and restoring funds.
      currentTxWallet = { ...currentTxWallet, balance: 1000 };
      currentTxTransaction = { ...currentTxTransaction, status: 'FAILED', newBalance: 1000 };
      return { status: 'FAILED', providerReference: 'TEST-FAILED-REF' } as any;
    });

    const result = await service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 250,
      provider: 'PAYSTACK',
    });

    expect(result).toMatchObject({
      duplicate: true,
      reconciliationConflict: false,
      transaction: { status: 'FAILED' },
    });
    expect(tx.customerWallet.update).toHaveBeenCalledTimes(1);
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 750 },
    });
    expect(result.wallet.balance).toBe(1000);
  });

  it('does not overwrite a failure already recorded by a webhook when the API later reports success', async () => {
    const wallet = { id: 'TEST-WALLET-001', customerId: 'TEST-CUSTOMER-001', balance: 1000, status: 'ACTIVE' };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;
    jest.spyOn(service, 'transferToVerifiedAccount').mockImplementation(async () => {
      // Simulate a signed webhook reconciling this transfer before the API response returns.
      currentTxWallet = { ...currentTxWallet, balance: 1000 };
      currentTxTransaction = { ...currentTxTransaction, status: 'FAILED', newBalance: 1000 };
      return { status: 'SUCCESSFUL', providerReference: 'TEST-LATE-SUCCESS-REF' } as any;
    });

    const result = await service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 250,
      provider: 'PAYSTACK',
    });

    expect(result.reconciliationConflict).toBe(true);
    expect(result.transaction.status).toBe('FAILED');
    expect(tx.walletTransaction.update).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).toHaveBeenCalledTimes(1);
    expect(result.wallet.balance).toBe(1000);
  });

  it('keeps funds reserved and does not auto-retry when provider outcome is uncertain', async () => {
    const wallet = { id: 'TEST-WALLET-001', customerId: 'TEST-CUSTOMER-001', balance: 1000, status: 'ACTIVE' };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    currentTxWallet = wallet;
    jest.spyOn(service, 'transferToVerifiedAccount').mockRejectedValue(new Error('network timeout'));

    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001', bankCode: '058', accountNumber: '1234567890',
      amount: 250, provider: 'PAYSTACK',
    })).rejects.toThrow('status is uncertain');

    expect(tx.customerWallet.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 750 },
    }));
    expect(tx.walletTransaction.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PROCESSING' }),
    }));
    expect(tx.walletTransaction.update).not.toHaveBeenCalled();
    expect(tx.customerWallet.update).toHaveBeenCalledTimes(1);
    expect(tx.customerWallet.update).toHaveBeenCalledWith({
      where: { id: 'TEST-WALLET-001' },
      data: { balance: 750 },
    });
  });

});
