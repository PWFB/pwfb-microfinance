import { BadRequestException } from '@nestjs/common';
import { ExternalBankTransferService } from './external-bank-transfer.service';

describe('ExternalBankTransferService outbound bank transfer', () => {
  let service: ExternalBankTransferService;
  let prisma: any;
  let tx: any;
  let paystack: any;

  beforeEach(() => {
    tx = {
      customerWallet: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      walletTransaction: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'test-withdrawal', ...data })),
      },
    };
    prisma = {
      customerWallet: { findUnique: jest.fn() },
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
    jest.spyOn(service, 'verifyCustomerBankAccount').mockResolvedValue({
      accountName: 'TEST BENEFICIARY',
      provider: 'PAYSTACK',
      customerNameVerified: true,
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

    expect(service.verifyCustomerBankAccount).not.toHaveBeenCalled();
    expect(service.transferToVerifiedAccount).not.toHaveBeenCalled();
  });

  it('rejects insufficient balance before initiating an outbound provider transfer', async () => {
    prisma.customerWallet.findUnique.mockResolvedValue({
      id: 'TEST-WALLET-001',
      customerId: 'TEST-CUSTOMER-001',
      balance: 50,
      status: 'ACTIVE',
    });

    await expect(service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 100,
      provider: 'PAYSTACK',
    })).rejects.toThrow('Insufficient wallet balance');

    expect(service.verifyCustomerBankAccount).toHaveBeenCalled();
    expect(service.transferToVerifiedAccount).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records an accepted provider transfer as a withdrawal and debits the wallet once', async () => {
    const wallet = {
      id: 'TEST-WALLET-001',
      customerId: 'TEST-CUSTOMER-001',
      balance: 1000,
      status: 'ACTIVE',
    };
    prisma.customerWallet.findUnique.mockResolvedValue(wallet);
    tx.customerWallet.findUnique.mockResolvedValue(wallet);

    const result = await service.transfer({
      customerId: 'TEST-CUSTOMER-001',
      bankCode: '058',
      accountNumber: '1234567890',
      amount: 250,
      description: 'TEST outbound bank transfer',
      provider: 'PAYSTACK',
    });

    expect(service.verifyCustomerBankAccount).toHaveBeenCalledWith(
      'TEST-CUSTOMER-001', '058', '1234567890', 'PAYSTACK',
    );
    expect(service.transferToVerifiedAccount).toHaveBeenCalledWith(expect.objectContaining({
      bankCode: '058',
      accountNumber: '1234567890',
      accountName: 'TEST BENEFICIARY',
      amount: 250,
      provider: 'PAYSTACK',
    }));
    expect(tx.customerWallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'TEST-WALLET-001', status: 'ACTIVE', balance: { gte: 250 } },
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
        providerReference: 'TEST-PROVIDER-REF-001',
        status: 'COMPLETED',
      }),
    }));
    expect(result.wallet.balance).toBe(750);
    expect(result.beneficiary).toMatchObject({
      accountNumber: '1234567890',
      accountName: 'TEST BENEFICIARY',
      verified: true,
      nameMatch: true,
    });
  });
});
