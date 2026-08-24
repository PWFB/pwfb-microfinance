import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
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
      throw new BadRequestException(
        data?.message || 'Paystack request failed',
      );
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
}
