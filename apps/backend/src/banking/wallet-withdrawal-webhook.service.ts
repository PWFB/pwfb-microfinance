import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletWithdrawalWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private checkSecret(secret?: string) {
    const expected = process.env.PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid virtual account webhook secret');
    }
  }

  async reconcile(payload: {
    transactionReference: string;
    status: 'COMPLETED' | 'FAILED';
    provider?: string;
    providerReference?: string;
    failureReason?: string;
    secret?: string;
  }) {
    this.checkSecret(payload.secret);

    const reference = String(payload.transactionReference ?? '').trim();
    if (!reference) {
      throw new BadRequestException('Transaction reference is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { reference },
      });

      if (!transaction) {
        throw new BadRequestException('Wallet withdrawal transaction not found');
      }

      if (transaction.type !== 'WITHDRAWAL') {
        throw new BadRequestException('Transaction is not a wallet withdrawal');
      }

      if (transaction.status === 'FAILED' || transaction.status === 'REVERSED') {
        return { ok: true, duplicate: true, transaction };
      }

      if (payload.status === 'COMPLETED') {
        const updated = await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'COMPLETED',
            provider: payload.provider ?? transaction.provider,
            providerReference: payload.providerReference ?? transaction.providerReference,
            processedAt: new Date(),
            failureReason: null,
          },
        });
        return { ok: true, duplicate: false, action: 'COMPLETED', transaction: updated };
      }

      const wallet = await tx.customerWallet.findUnique({
        where: { customerId: transaction.customerId },
      });

      if (!wallet) {
        throw new BadRequestException('Customer wallet not found while reversing withdrawal');
      }

      const restoredBalance = Math.round((wallet.balance + transaction.amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: restoredBalance },
      });

      const updated = await tx.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'FAILED',
          provider: payload.provider ?? transaction.provider,
          providerReference: payload.providerReference ?? transaction.providerReference,
          failureReason: payload.failureReason ?? 'Withdrawal provider reported failure',
          reversedAt: new Date(),
          processedAt: new Date(),
          newBalance: restoredBalance,
        },
      });

      return {
        ok: true,
        duplicate: false,
        action: 'REFUNDED',
        wallet: updatedWallet,
        transaction: updated,
      };
    });
  }
}
