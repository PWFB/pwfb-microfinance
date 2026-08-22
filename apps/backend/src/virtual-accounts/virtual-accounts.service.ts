import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVirtualAccountInput, VIRTUAL_ACCOUNT_PROVIDER, VirtualAccountProvider } from './virtual-accounts.types';

@Injectable()
export class VirtualAccountsService {
  private readonly logger = new Logger(VirtualAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VIRTUAL_ACCOUNT_PROVIDER)
    private readonly provider: VirtualAccountProvider,
  ) {}

  async provision(input: CreateVirtualAccountInput) {
    const existing = await this.findByCustomer(input.customerId);
    if (existing?.status === 'ACTIVE') return existing;

    await this.prisma.$executeRaw`
      INSERT INTO "CustomerVirtualAccount"
        ("id", "customerId", "branchId", "provider", "status", "isPrimary", "createdAt", "updatedAt")
      VALUES
        (${`cva-${input.customerId}`}, ${input.customerId}, ${input.branchId}, 'PAYSTACK', 'PENDING', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("customerId") DO UPDATE SET
        "branchId" = EXCLUDED."branchId",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    try {
      const account = await this.provider.createVirtualAccount(input);

      await this.prisma.$executeRaw`
        UPDATE "CustomerVirtualAccount"
        SET "accountNumber" = ${account.accountNumber},
            "accountName" = ${account.accountName},
            "bankName" = ${account.bankName},
            "bankCode" = ${account.bankCode ?? null},
            "providerReference" = ${account.providerReference},
            "provider" = 'PAYSTACK',
            "status" = 'ACTIVE',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "customerId" = ${input.customerId}
      `;

      this.logger.log(`Virtual account provisioned for customer ${input.customerId}`);
      return this.findByCustomer(input.customerId);
    } catch (error) {
      this.logger.warn(`Virtual account provisioning pending for customer ${input.customerId}`);
      return this.findByCustomer(input.customerId);
    }
  }

  async findByCustomer(customerId: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT "id", "customerId", "branchId", "accountNumber", "accountName",
             "bankName", "bankCode", "provider", "providerReference",
             "status", "isPrimary", "createdAt", "updatedAt"
      FROM "CustomerVirtualAccount"
      WHERE "customerId" = ${customerId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  /**
   * Credits a PWFB customer after Paystack confirms a successful transfer
   * into that customer's dedicated virtual account.
   *
   * The Paystack transaction ID/reference becomes the idempotency key. A
   * repeated webhook therefore cannot credit the wallet twice.
   */
  async processPaystackCharge(data: any) {
    const amount = Number(data?.amount) / 100;
    const reference = String(data?.reference || data?.id || '').trim();
    const receiverAccount = String(
      data?.authorization?.receiver_bank_account_number ||
      data?.receiver_bank_account_number ||
      '',
    ).trim();

    if (!reference || !Number.isFinite(amount) || amount <= 0 || !receiverAccount) {
      return { processed: false, reason: 'invalid_charge_payload' };
    }

    if (String(data?.status || '').toLowerCase() !== 'success') {
      return { processed: false, reason: 'charge_not_successful' };
    }

    const currency = String(data?.currency || 'NGN').toUpperCase();
    if (currency !== 'NGN') {
      return { processed: false, reason: 'unsupported_currency' };
    }

    const walletReference = `PAYSTACK-${reference}`;

    return this.prisma.$transaction(async (tx) => {
      const accounts = await tx.$queryRaw<any[]>`
        SELECT "id", "customerId", "branchId", "accountNumber", "status"
        FROM "CustomerVirtualAccount"
        WHERE "accountNumber" = ${receiverAccount}
          AND "provider" = 'PAYSTACK'
        LIMIT 1
      `;

      const virtualAccount = accounts[0];
      if (!virtualAccount) {
        return { processed: false, reason: 'virtual_account_not_found' };
      }

      if (virtualAccount.status !== 'ACTIVE') {
        return { processed: false, reason: 'virtual_account_not_active' };
      }

      const existing = await tx.walletTransaction.findUnique({
        where: { reference: walletReference },
      });

      if (existing) {
        return {
          processed: true,
          duplicate: true,
          customerId: existing.customerId,
          transactionId: existing.id,
        };
      }

      const customer = await tx.customer.findUnique({
        where: { id: virtualAccount.customerId },
      });

      if (!customer) {
        return { processed: false, reason: 'customer_not_found' };
      }

      const wallet = await tx.customerWallet.upsert({
        where: { customerId: customer.id },
        create: { customerId: customer.id, balance: 0 },
        update: {},
      });

      if (wallet.status !== 'ACTIVE') {
        return { processed: false, reason: 'wallet_not_active' };
      }

      const previousBalance = Number(wallet.balance);
      const newBalance = Math.round((previousBalance + amount) * 100) / 100;

      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const senderName = String(data?.authorization?.sender_name || '').trim();
      const senderBank = String(data?.authorization?.sender_bank || '').trim();
      const description = [
        'Automatic bank transfer deposit',
        senderName ? `from ${senderName}` : '',
        senderBank ? `(${senderBank})` : '',
      ].filter(Boolean).join(' ');

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: customer.id,
          type: 'DEPOSIT',
          amount,
          previousBalance,
          newBalance,
          reference: walletReference,
          description,
          branchId: virtualAccount.branchId || undefined,
        },
      });

      this.logger.log(
        `Paystack deposit ${reference} credited customer ${customer.id} with NGN ${amount}`,
      );

      return {
        processed: true,
        duplicate: false,
        customerId: customer.id,
        wallet: updatedWallet,
        transaction,
      };
    });
  }
}
