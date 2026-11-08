import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
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

  private checkFlutterwaveSignature(rawBody: string, signature?: string) {
    const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH?.trim();
    if (!secret || !signature) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature.trim());
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid Flutterwave webhook signature');
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

    let existing = await this.prisma.customerVirtualAccount.findFirst({
      where: {
        OR: [
          { accountNumber },
          ...(providerReference ? [{ providerReference }] : []),
          ...(payload.customerId
            ? [{ customerId: payload.customerId, status: 'PENDING' }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerId = existing?.customerId ?? payload.customerId;
    if (!customerId) {
      throw new BadRequestException('Customer ID is required when assigning a new virtual account');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(`Customer ${customerId} was not found`);
    }

    if (providerReference && existing && existing.providerReference !== providerReference) {
      const byProviderReference = await this.prisma.customerVirtualAccount.findUnique({
        where: { providerReference },
      });
      if (byProviderReference && byProviderReference.id !== existing.id) {
        throw new ConflictException('Provider reference is already assigned to another virtual account');
      }
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

    try {
      const virtualAccount = existing
        ? await this.prisma.customerVirtualAccount.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.customerVirtualAccount.create({
            data: { id: randomUUID(), ...data },
          });

      return {
        ok: true,
        accountNumber: virtualAccount.accountNumber,
        accountName: virtualAccount.accountName,
        provider: virtualAccount.provider,
        providerReference: virtualAccount.providerReference,
        customerId: virtualAccount.customerId,
        status: virtualAccount.status,
        assignedAt: virtualAccount.assignedAt,
      };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        throw new ConflictException('Virtual account or provider reference is already assigned');
      }
      if (code === 'P2003') {
        throw new BadRequestException('Virtual account references a missing bank, branch, or customer');
      }
      throw error;
    }
  }

  /**
   * Legacy/provider-neutral deposit contract retained for internal integrations.
   */
  async deposit(payload: {
    accountNumber: string;
    amount: number;
    provider?: string;
    providerReference: string;
    description?: string;
    secret?: string;
  }) {
    this.checkSecret(payload.secret);
    return this.applyDeposit({
      accountNumber: payload.accountNumber,
      amount: payload.amount,
      provider: payload.provider,
      providerReference: payload.providerReference,
      description: payload.description,
    });
  }

  /**
   * Handles Flutterwave DVA/static-account credit notifications.
   *
   * We verify the exact raw body first, then normalize the several field names
   * Flutterwave can use for account number/reference/status. Credits are only
   * accepted for successful NGN transactions and are idempotent by the
   * provider reference.
   */
  async depositFlutterwave(input: {
    body: any;
    signature?: string;
    rawBody?: Buffer;
  }) {
    const rawBody = input.rawBody?.toString('utf8') ?? JSON.stringify(input.body ?? {});
    this.checkFlutterwaveSignature(rawBody, input.signature);

    const body = input.body ?? {};
    const data = body?.data ?? body?.result ?? {};
    const event = String(body?.event ?? body?.event_type ?? body?.type ?? '').toLowerCase();

    const status = String(
      data?.status ?? data?.payment_status ?? data?.transaction_status ?? body?.status ?? '',
    ).toUpperCase();

    if (status && !['SUCCESSFUL', 'SUCCESS', 'COMPLETED', 'SETTLED'].includes(status)) {
      return { ok: true, ignored: true, reason: 'non-successful-event', status };
    }

    // Do not let an arbitrary signed provider event credit a wallet unless it
    // actually identifies a successful transaction.
    if (!status) {
      return { ok: true, ignored: true, reason: 'missing-success-status', event };
    }

    const accountNumber = String(
      data?.account_number ??
      data?.accountNumber ??
      data?.virtual_account_number ??
      data?.destination_account_number ??
      data?.beneficiary_account_number ??
      '',
    ).replace(/\D/g, '');

    const amount = Number(
      data?.amount ??
      data?.charged_amount ??
      data?.settled_amount ??
      data?.transaction_amount ??
      0,
    );

    const providerReference = String(
      data?.tx_ref ??
      data?.reference ??
      data?.flw_ref ??
      data?.transaction_reference ??
      data?.id ??
      body?.tx_ref ??
      body?.reference ??
      '',
    ).trim();

    const currency = String(data?.currency ?? data?.currency_code ?? 'NGN').toUpperCase();
    const description = String(
      data?.narration ?? data?.description ?? data?.meta?.description ?? `Flutterwave virtual account credit ${accountNumber}`,
    ).trim();

    if (!accountNumber) {
      throw new BadRequestException('Flutterwave virtual account number is required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Flutterwave virtual account deposit amount must be greater than zero');
    }
    if (currency !== 'NGN') {
      return { ok: true, ignored: true, reason: 'unsupported-currency', currency };
    }
    if (!providerReference) {
      throw new BadRequestException('Flutterwave provider reference is required');
    }

    return this.applyDeposit({
      accountNumber,
      amount,
      provider: 'FLUTTERWAVE',
      providerReference,
      description,
    });
  }

  private async applyDeposit(payload: {
    accountNumber: string;
    amount: number;
    provider?: string;
    providerReference: string;
    description?: string;
  }) {
    const accountNumber = String(payload.accountNumber ?? '').replace(/\D/g, '');
    const amount = Math.round(Number(payload.amount) * 100) / 100;
    const providerReference = String(payload.providerReference ?? '').trim();

    if (!accountNumber || !Number.isFinite(amount) || amount <= 0 || !providerReference) {
      throw new BadRequestException('Account number, positive amount and provider reference are required');
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.walletTransaction.findUnique({
        where: { providerReference },
      });
      if (duplicate) {
        return { ok: true, duplicate: true, transaction: duplicate };
      }

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

      const previousBalance = Number(wallet.balance);
      const newBalance = Math.round((previousBalance + amount) * 100) / 100;

      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: virtualAccount.customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance,
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

      return {
        ok: true,
        duplicate: false,
        wallet: updatedWallet,
        transaction,
      };
    });
  }
}
