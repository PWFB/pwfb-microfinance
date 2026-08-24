import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaystackService {
  private readonly baseUrl =
    process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

  constructor(private readonly prisma: PrismaService) {}

  private getSecretKey() {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new BadRequestException('Paystack integration is not configured');
    }
    return key;
  }

  private async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.getSecretKey()}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.status) {
      throw new BadRequestException(data?.message || 'Paystack request failed');
    }

    return data;
  }

  async testConnection() {
    const data = await this.request('/bank');
    return {
      ok: true,
      provider: 'PAYSTACK',
      message: data.message,
      bankCount: Array.isArray(data.data) ? data.data.length : 0,
    };
  }

  async getCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async initializeCustomerPayment(customerId: string, amount: number) {
    const customer = await this.getCustomer(customerId);

    if (!customer.email) {
      throw new BadRequestException(
        'Customer email is required for Paystack payment',
      );
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const reference = `PWFB-${Date.now()}-${randomUUID()
      .slice(0, 8)
      .toUpperCase()}`;

    const data = await this.request('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: customer.email,
        amount: Math.round(numericAmount * 100),
        currency: 'NGN',
        reference,
        metadata: {
          customerId: customer.id,
          provider: 'PAYSTACK',
          purpose: 'PWFB_WALLET_DEPOSIT',
        },
      }),
    });

    return {
      ok: true,
      reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
    };
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) return false;

    const expected = createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const suppliedBuffer = Buffer.from(signature, 'utf8');

    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }

  async handleWebhook(event: any) {
    if (event?.event !== 'charge.success') {
      return { ok: true, processed: false, message: 'Event ignored' };
    }

    const payment = event?.data;
    const reference = payment?.reference;
    const metadata = payment?.metadata;
    const customerId = metadata?.customerId;

    if (!reference || !customerId) {
      throw new BadRequestException(
        'Paystack payment is missing reference or customer ID',
      );
    }

    if (payment?.status !== 'success') {
      return { ok: true, processed: false, message: 'Payment is not successful' };
    }

    const amount = Number(payment.amount) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid Paystack payment amount');
    }

    const providerReference = String(payment.id ?? reference);

    const existing = await this.prisma.walletTransaction.findFirst({
      where: {
        OR: [
          { reference: `PAY-${reference}` },
          { providerReference },
        ],
      },
      select: { id: true, reference: true },
    });

    if (existing) {
      return {
        ok: true,
        processed: false,
        duplicate: true,
        transactionId: existing.id,
        reference: existing.reference,
      };
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.walletTransaction.findFirst({
        where: {
          OR: [
            { reference: `PAY-${reference}` },
            { providerReference },
          ],
        },
        select: { id: true, reference: true },
      });

      if (duplicate) {
        return {
          ok: true,
          processed: false,
          duplicate: true,
          transactionId: duplicate.id,
          reference: duplicate.reference,
        };
      }

      const wallet = await tx.customerWallet.upsert({
        where: { customerId },
        create: { customerId, balance: 0 },
        update: {},
      });

      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Customer wallet is not active');
      }

      const newBalance =
        Math.round((wallet.balance + amount) * 100) / 100;

      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance: wallet.balance,
          newBalance,
          reference: `PAY-${reference}`,
          description: 'Paystack wallet deposit',
          status: 'COMPLETED',
          provider: 'PAYSTACK',
          providerReference,
          processedAt: new Date(),
        },
      });

      return {
        ok: true,
        processed: true,
        transaction,
        wallet: updatedWallet,
      };
    });
  }

  async verifyAndCredit(reference: string) {
    const data = await this.request(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );

    if (data.data?.status !== 'success') {
      throw new BadRequestException('Paystack payment is not successful');
    }

    const metadata = data.data.metadata;
    const customerId = metadata?.customerId;

    if (!customerId) {
      throw new BadRequestException('Paystack payment has no customer ID');
    }

    return this.handleWebhook({
      event: 'charge.success',
      data: data.data,
    });
  }
}
