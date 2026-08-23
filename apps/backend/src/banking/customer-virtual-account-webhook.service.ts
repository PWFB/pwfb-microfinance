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
    const providerReference = String(payload.providerReference ?? '').trim() || undefined;
    const status = payload.status ?? 'ACTIVE';

    if (!accountNumber) {
      throw new BadRequestException('Account number is required');
    }

    const existing = await this.prisma.customerVirtualAccount.findFirst({
      where: {
        OR: [
          { accountNumber },
          ...(providerReference ? [{ providerReference }] : []),
        ],
      },
    });

    const customerId = existing?.customerId ?? payload.customerId;
    if (!customerId) {
      throw new BadRequestException('Customer ID is required when assigning a new virtual account');
    }

    // Validate the customer before attempting the write so provider webhooks
    // return a useful 4xx response instead of an opaque database 500.
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(`Customer ${customerId} was not found`);
    }

    const data = {
      customerId,
      institutionId: payload.institutionId ?? existing?.institutionId ?? null,
      branchId: payload.branchId ?? existing?.branchId ?? null,
      accountNumber,
      accountName: payload.accountName ?? existing?.accountName ?? null,
      provider: payload.provider ?? existing?.provider ?? null,
      providerReference: providerReference ?? existing?.providerReference ?? null,
      status,
      assignedAt: status === 'ACTIVE' ? new Date() : existing?.assignedAt ?? null,
      failureReason: payload.failureReason ?? null,
    };

    const virtualAccount = existing
      ? await this.prisma.customerVirtualAccount.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.customerVirtualAccount.create({
          data: {
            id: randomUUID(),
            ...data,
          },
        });

    return {
      ok: true,
      accountNumber: virtualAccount.accountNumber,
      customerId: virtualAccount.customerId,
      status: virtualAccount.status,
    };
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
      const duplicate = await tx.walletTransaction.findUnique({
        where: { providerReference },
      });
      if (duplicate) return { ok: true, duplicate: true, transaction: duplicate };

      const virtualAccount = await tx.customerVirtualAccount.findFirst({
        where: { accountNumber, status: 'ACTIVE' },
      });
      if (!virtualAccount) {
        throw new BadRequestException('Active customer virtual account not found');
      }

      const wallet = await tx.customerWallet.upsert({
        where: { customerId: virtualAccount.customerId },
        create: { customerId: virtualAccount.customerId, balance: 0 },
        update: {},
      });
      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Customer wallet is not active');
      }

      const newBalance = Math.round((wallet.balance + amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: virtualAccount.customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance: wallet.balance,
          newBalance,
          reference: `VAD-${providerReference}-${randomUUID().slice(0, 8)}`,
          description: payload.description ?? `Virtual account deposit ${accountNumber}`,
          branchId: virtualAccount.branchId ?? undefined,
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
