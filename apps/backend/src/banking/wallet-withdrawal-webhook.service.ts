import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveService } from './flutterwave.service';

@Injectable()
export class WalletWithdrawalWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwaveService: FlutterwaveService,
  ) {}

  private checkLegacySecret(secret?: string) {
    const expected = process.env.PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid virtual account webhook secret');
    }
  }

  private checkFlutterwaveSignature(rawBody: string, signature?: string) {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim();
    if (!secret || !signature) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
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
    this.checkLegacySecret(payload.secret);
    return this.applyReconciliation(payload);
  }

  async reconcileFlutterwave(input: {
    body: any;
    signature?: string;
    rawBody?: Buffer;
  }) {
    const rawBody = input.rawBody?.toString('utf8') ?? JSON.stringify(input.body ?? {});
    this.checkFlutterwaveSignature(rawBody, input.signature);

    const data = input.body?.data ?? {};
    const reference = String(data.reference ?? data.tx_ref ?? '').trim();
    const providerReference = String(data.id ?? data.flw_ref ?? '').trim();
    if (!reference) throw new BadRequestException('Flutterwave webhook transfer reference is required');

    let status = String(data.status ?? '').toUpperCase();
    if (providerReference) {
      try {
        const verified = await this.flutterwaveService.getTransferStatus(providerReference);
        const verifiedStatus = String(verified?.data?.status ?? '').toUpperCase();
        if (verifiedStatus) status = verifiedStatus;
      } catch {
        throw new UnauthorizedException('Unable to verify Flutterwave transfer webhook');
      }
    }

    if (status === 'SUCCESSFUL' || status === 'COMPLETED') {
      return this.applyReconciliation({
        transactionReference: reference,
        status: 'COMPLETED',
        provider: 'FLUTTERWAVE',
        providerReference: providerReference || reference,
      });
    }

    if (status === 'FAILED') {
      return this.applyReconciliation({
        transactionReference: reference,
        status: 'FAILED',
        provider: 'FLUTTERWAVE',
        providerReference: providerReference || reference,
        failureReason: String(data.complete_message ?? data.processor_response ?? 'Flutterwave reported transfer failure'),
      });
    }

    return { ok: true, ignored: true, status };
  }

  private async applyReconciliation(payload: {
    transactionReference: string;
    status: 'COMPLETED' | 'FAILED';
    provider?: string;
    providerReference?: string;
    failureReason?: string;
  }) {
    const reference = String(payload.transactionReference ?? '').trim();
    if (!reference) throw new BadRequestException('Transaction reference is required');

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({ where: { reference } });
      if (!transaction) throw new BadRequestException('Wallet withdrawal transaction not found');
      if (transaction.type !== 'WITHDRAWAL') throw new BadRequestException('Transaction is not a wallet withdrawal');

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

      if (transaction.status === 'COMPLETED') {
        return { ok: true, duplicate: true, transaction };
      }

      const wallet = await tx.customerWallet.findUnique({ where: { customerId: transaction.customerId } });
      if (!wallet) throw new BadRequestException('Customer wallet not found while reversing withdrawal');

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

      return { ok: true, duplicate: false, action: 'REFUNDED', wallet: updatedWallet, transaction: updated };
    });
  }
}
