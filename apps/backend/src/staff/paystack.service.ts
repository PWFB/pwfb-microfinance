import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class PaystackService {
  private secretKey() {
    const value = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!value) throw new ServiceUnavailableException('Paystack Secret Key is not configured. Add PAYSTACK_SECRET_KEY to the PWFB backend environment.');
    return value;
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${this.secretKey()}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    const response = await fetch(`https://api.paystack.co${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status === false) {
      throw new BadRequestException(String(payload?.message || `Paystack request failed with status ${response.status}`));
    }
    return payload;
  }

  async listBanks() {
    const payload = await this.request('/bank?country=nigeria&currency=NGN&perPage=100');
    return Array.isArray(payload?.data)
      ? payload.data.map((bank: any) => ({ code: String(bank?.code || '').trim(), name: String(bank?.name || '').trim() })).filter((bank: any) => bank.code && bank.name)
      : [];
  }

  async resolveAccount(bankCode: string, accountNumber: string) {
    const code = String(bankCode || '').trim();
    const number = String(accountNumber || '').replace(/\D/g, '');
    if (!code) throw new BadRequestException('Bank is required');
    if (!/^\d{10}$/.test(number)) throw new BadRequestException('Account number must be exactly 10 digits');
    const payload = await this.request(`/bank/resolve?account_number=${encodeURIComponent(number)}&bank_code=${encodeURIComponent(code)}`);
    const data = payload?.data || {};
    const accountName = String(data.account_name || '').trim();
    if (!accountName) throw new BadRequestException('Paystack could not resolve the account name');
    return { accountNumber: number, accountName, bankCode: code, bankId: data.bank_id ?? null };
  }

  async createCustomer(input: { email: string; firstName: string; lastName: string; phone?: string }) {
    const payload = await this.request('/customer', {
      method: 'POST',
      body: JSON.stringify({ email: input.email, first_name: input.firstName, last_name: input.lastName, ...(input.phone ? { phone: input.phone } : {}) }),
    });
    const code = String(payload?.data?.customer_code || '').trim();
    if (!code) throw new ServiceUnavailableException('Paystack did not return a customer code');
    return { customerCode: code };
  }

  async validateCustomer(input: { customerCode: string; bvn: string; firstName: string; lastName: string; accountNumber: string; bankCode: string; middleName?: string }) {
    const bvn = String(input.bvn || '').replace(/\D/g, '');
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(bvn)) throw new BadRequestException('BVN must be exactly 11 digits');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Account number must be exactly 10 digits');
    const payload = await this.request(`/customer/${encodeURIComponent(input.customerCode)}/identification`, {
      method: 'POST',
      body: JSON.stringify({ country: 'NG', type: 'bank_account', account_number: accountNumber, bvn, bank_code: input.bankCode, first_name: input.firstName, last_name: input.lastName, ...(input.middleName ? { middle_name: input.middleName } : {}) }),
    });
    return { accepted: Boolean(payload?.status), message: String(payload?.message || 'Customer identification in progress'), customerCode: input.customerCode };
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string) {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const secret = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secret || !signature) return false;
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(signature).trim(), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  isConfigured() { return Boolean(String(process.env.PAYSTACK_SECRET_KEY || '').trim()); }
}
