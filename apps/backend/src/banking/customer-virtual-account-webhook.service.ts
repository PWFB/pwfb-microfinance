import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomerVirtualAccountWebhookService {
  constructor(private readonly prisma: PrismaService) {}

  private checkSecret(secret?: string) {
    const expected = process.env.PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid virtual account webhook secret');
    }
  }

  async assign(payload: {
    accountNumber: string;
    accountName?: string;
    provider?: string;
    providerReference?: string;
    institutionId?: string;
    customerId?: string;
    branchId?: string;
    status?: 'ACTIVE' | 'FAILED' | 'INACTIVE';
    failureReason?: string;
    secret?: string;
  }) {
    this.checkSecret(payload.secret);
    const accountNumber = String(payload.accountNumber ?? '').replace(/\D/g, '');
    if (!accountNumber) throw new BadRequestException('Account number is required');

    const existing = await this.prisma.$queryRaw<any[]>`
      SELECT "id", "customerId", "status"
      FROM "CustomerVirtualAccount"
      WHERE "accountNumber" = ${accountNumber}
         OR (${payload.providerReference ?? null} IS NOT NULL AND "providerReference" = ${payload.providerReference ?? null})
      LIMIT 1
    `;

    if (existing.length === 0 && !payload.customerId) {
      throw new BadRequestException('Customer ID is required when assigning a new virtual account');
    }

    const customerId = existing[0]?.customerId ?? payload.customerId;
    const status = payload.status ?? 'ACTIVE';

    await this.prisma.$executeRaw`
      INSERT INTO "CustomerVirtualAccount"
        ("id", "customerId", "institutionId", "branchId", "accountNumber", "accountName", "provider", "providerReference", "status", "assignedAt", "failureReason", "requestedAt", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}, ${customerId}, ${payload.institutionId ?? null}, ${payload.branchId ?? null}, ${accountNumber}, ${payload.accountName ?? null}, ${payload.provider ?? null}, ${payload.providerReference ?? null}, ${status}, ${status === 'ACTIVE' ? new Date() : null}, ${payload.failureReason ?? null}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("accountNumber") DO UPDATE SET
        "customerId" = EXCLUDED."customerId",
        "institutionId" = COALESCE(EXCLUDED."institutionId", "CustomerVirtualAccount"."institutionId"),
        "branchId" = COALESCE(EXCLUDED."branchId", "CustomerVirtualAccount"."branchId"),
        "accountName" = COALESCE(EXCLUDED."accountName", "CustomerVirtualAccount"."accountName"),
        "provider" = COALESCE(EXCLUDED."provider", "CustomerVirtualAccount"."provider"),
        "providerReference" = COALESCE(EXCLUDED."providerReference", "CustomerVirtualAccount"."providerReference"),
        "status" = EXCLUDED."status",
        "assignedAt" = CASE WHEN EXCLUDED."status" = 'ACTIVE' THEN CURRENT_TIMESTAMP ELSE "CustomerVirtualAccount"."assignedAt" END,
        "failureReason" = EXCLUDED."failureReason",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    return { ok: true, accountNumber, customerId, status };
  }

  async deposit(payload: {
    accountNumber: string;
    amount: number;
    provider?: string;
    providerReference: string;
    description?: string;
    secret?: string;
  }) {
    this.checkSecret(payload.secret);
    const accountNumber = String(payload.accountNumber ?? '').replace(/\D/g, '');
    const amount = Number(payload.amount);
    const providerReference = String(payload.providerReference ?? '').trim();

    if (!accountNumber || !Number.isFinite(amount) || amount <= 0 || !providerReference) {
      throw new BadRequestException('Account number, positive amount and provider reference are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.$queryRaw<any[]>`
        SELECT "id", "customerId", "amount", "newBalance"
        FROM "WalletTransaction"
        WHERE "providerReference" = ${providerReference}
        LIMIT 1
      `;
      if (duplicate.length) return { ok: true, duplicate: true, transaction: duplicate[0] };

      const virtualAccount = await tx.$queryRaw<any[]>`
        SELECT "id", "customerId", "branchId", "status"
        FROM "CustomerVirtualAccount"
        WHERE "accountNumber" = ${accountNumber} AND "status" = 'ACTIVE'
        LIMIT 1
      `;
      if (!virtualAccount.length) throw new BadRequestException('Active customer virtual account not found');

      const va = virtualAccount[0];
      const wallet = await tx.customerWallet.upsert({
        where: { customerId: va.customerId },
        create: { customerId: va.customerId, balance: 0 },
        update: {},
      });
      if (wallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');

      const newBalance = Math.round((wallet.balance + amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: va.customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance: wallet.balance,
          newBalance,
          reference: `VAD-${providerReference}-${randomUUID().slice(0, 8)}`,
          description: payload.description ?? `Virtual account deposit ${accountNumber}`,
          branchId: va.branchId ?? undefined,
          status: 'COMPLETED',
          provider: payload.provider ?? undefined,
          providerReference,
          processedAt: new Date(),
        },
      });

      return { ok: true, duplicate: false, wallet: updatedWallet, transaction };
    });
  }
}
