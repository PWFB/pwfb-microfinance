import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type FlutterwaveAccountNameResult = {
  accountNumber: string;
  accountName: string;
  bankCode: string;
};

export type FlutterwaveBank = {
  id: string;
  code: string;
  name: string;
};

@Injectable()
export class FlutterwaveService {
  private baseUrl() {
    return (process.env.FLUTTERWAVE_BASE_URL?.trim() || 'https://api.flutterwave.com/v3').replace(/\/$/, '');
  }

  private secretKey() {
    const key = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('Flutterwave integration is not configured');
    return key;
  }

  private headers() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.secretKey()}`,
    };
  }

  private async request(path: string, init: RequestInit) {
    try {
      const response = await fetch(`${this.baseUrl()}${path}`, {
        ...init,
        headers: { ...this.headers(), ...(init.headers || {}) },
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = String(
          (payload as any)?.message ??
            (payload as any)?.error?.message ??
            `Flutterwave request failed with status ${response.status}`,
        );
        throw new ServiceUnavailableException(message);
      }
      return payload as any;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Flutterwave service is unavailable');
    }
  }

  async listBanks(country = 'NG'): Promise<FlutterwaveBank[]> {
    const normalizedCountry = String(country || 'NG').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) throw new BadRequestException('Invalid country code');
    const payload = await this.request(`/banks/${normalizedCountry}`, { method: 'GET' });
    const banks = Array.isArray(payload?.data) ? payload.data : [];
    return banks
      .map((bank: any) => {
        const code = String(bank?.code ?? bank?.bank_code ?? '').trim();
        const name = String(bank?.name ?? bank?.bank_name ?? '').trim();
        const providerId = String(bank?.id ?? code).trim();
        return { id: providerId || code, code, name };
      })
      .filter((bank: FlutterwaveBank) => Boolean(bank.code && bank.name));
  }

  async nameEnquiry(bankCode: string, accountNumber: string): Promise<FlutterwaveAccountNameResult> {
    const code = String(bankCode || '').trim();
    const number = String(accountNumber || '').replace(/\D/g, '');
    if (!code) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(number)) throw new BadRequestException('Enter a valid 10-digit account number');

    const payload = await this.request('/accounts/resolve', {
      method: 'POST',
      body: JSON.stringify({
        account_bank: code,
        bank_code: code,
        account_number: number,
      }),
    });

    const data = payload?.data ?? {};
    const accountName = String(data.account_name ?? data.accountName ?? '').trim();
    if (!accountName) throw new BadRequestException(payload?.message || 'Account name could not be resolved');

    return {
      accountNumber: String(data.account_number ?? data.accountNumber ?? number).replace(/\D/g, ''),
      accountName,
      bankCode: String(data.account_bank ?? data.bank_code ?? data.bankCode ?? code),
    };
  }

  async transfer(input: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    narration: string;
    reference: string;
  }) {
    const bankCode = String(input.bankCode || '').trim();
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    const accountName = String(input.accountName || '').trim();
    const amount = Math.round(Number(input.amount) * 100) / 100;

    if (!bankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!accountName) throw new BadRequestException('Verified beneficiary account name is required');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    if (!input.reference) throw new BadRequestException('Transfer reference is required');

    const callbackUrl = process.env.FLUTTERWAVE_CALLBACK_URL?.trim();
    const payload = await this.request('/transfers', {
      method: 'POST',
      body: JSON.stringify({
        account_bank: bankCode,
        bank_code: bankCode,
        account_number: accountNumber,
        amount,
        currency: 'NGN',
        debit_currency: 'NGN',
        beneficiary_name: accountName,
        narration: input.narration.slice(0, 180),
        reference: input.reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
      }),
    });

    const data = payload?.data ?? {};
    return {
      provider: 'FLUTTERWAVE',
      providerReference: String(data.id ?? data.flw_ref ?? data.reference ?? input.reference),
      transactionReference: String(data.reference ?? input.reference),
      status: String(data.status ?? 'NEW').toUpperCase(),
      raw: payload,
    };
  }

  async getTransferStatus(providerReference: string) {
    const id = String(providerReference || '').trim();
    if (!id) throw new BadRequestException('Flutterwave transfer reference is required');
    return this.request(`/transfers/${encodeURIComponent(id)}`, { method: 'GET' });
  }
}
