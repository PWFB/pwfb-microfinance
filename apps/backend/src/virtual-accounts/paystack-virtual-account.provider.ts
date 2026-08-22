import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateVirtualAccountInput, CreatedVirtualAccount, VirtualAccountProvider } from './virtual-accounts.types';

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

interface PaystackCustomer {
  customer_code: string;
}

interface PaystackDedicatedAccount {
  id: number;
  account_name: string;
  account_number: string;
  active: boolean;
  assigned: boolean;
  bank: { name: string; slug: string };
}

@Injectable()
export class PaystackVirtualAccountProvider implements VirtualAccountProvider {
  private readonly baseUrl = 'https://api.paystack.co';

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<CreatedVirtualAccount> {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) throw new Error('PAYSTACK_SECRET_KEY is not configured');

    const [firstName, ...rest] = input.accountName.trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;
    const email = input.customerReference.includes('@')
      ? input.customerReference
      : `${input.customerId}@virtual.pwfb.local`;

    const customer = await this.request<PaystackCustomer>('/customer', {
      method: 'POST',
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    const preferredBank = process.env.PAYSTACK_DVA_BANK_SLUG;
    const account = await this.request<PaystackDedicatedAccount>('/dedicated_account', {
      method: 'POST',
      body: JSON.stringify({
        customer: customer.customer_code,
        ...(preferredBank ? { preferred_bank: preferredBank } : {}),
      }),
      headers: { 'X-Idempotency-Key': `pwfb-dva-${input.customerId}-${randomUUID()}` },
    });

    if (!account.active || !account.assigned || !account.account_number) {
      throw new Error('Paystack did not return an active dedicated account');
    }

    return {
      accountNumber: account.account_number,
      accountName: account.account_name,
      bankName: account.bank.name,
      providerReference: String(account.id),
    };
  }

  private async request<T>(path: string, init: RequestInit & { headers?: Record<string, string> }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });

    const payload = (await response.json()) as PaystackResponse<T>;
    if (!response.ok || !payload.status) {
      throw new Error(payload.message || `Paystack request failed with ${response.status}`);
    }

    return payload.data;
  }
}
