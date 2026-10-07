import { BadRequestException } from '@nestjs/common';
import { LoansService } from './loans.service';
import { TransactionsService } from '../transactions/transactions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PWFB financial regression', () => {
  it('allocates loan repayment between principal and interest and preserves total outstanding', async () => {
    const prisma: any = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { principalPaid: 300, interestPaid: 50 },
      ]),
      $executeRawUnsafe: jest.fn(),
    };
    const service = new LoansService(prisma as PrismaService);

    const loan = {
      id: 'loan-1',
      amount: 1000,
      interestRate: 10,
      repayments: [{ amount: 350 }],
    };

    const result = await (service as any).withMeta(loan);

    expect(result.interestAmount).toBe(100);
    expect(result.totalRepayment).toBe(1100);
    expect(result.paidAmount).toBe(350);
    expect(result.principalPaid).toBe(300);
    expect(result.interestPaid).toBe(50);
    expect(result.principalOutstanding).toBe(700);
    expect(result.interestOutstanding).toBe(50);
    expect(result.outstandingAmount).toBe(750);
  });

  it('prevents manual mutation or deletion of financial ledger transactions', async () => {
    const prisma: any = {
      walletTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'wallet-tx-1',
          customerId: 'c1',
          type: 'DEPOSIT',
          amount: 500,
          previousBalance: 0,
          newBalance: 500,
          status: 'COMPLETED',
          customer: { id: 'c1' },
          createdAt: new Date(),
        }),
      },
      transaction: { findUnique: jest.fn() },
    };
    const service = new TransactionsService(prisma as PrismaService);

    await expect(service.update('wallet-tx-1', {} as any))
      .rejects.toThrow(new BadRequestException(
        'Wallet transactions are system-generated and cannot be edited from the ledger',
      ));

    await expect(service.remove('wallet-tx-1'))
      .rejects.toThrow(new BadRequestException(
        'Wallet transactions are system-generated and cannot be deleted from the ledger',
      ));
  });
});
