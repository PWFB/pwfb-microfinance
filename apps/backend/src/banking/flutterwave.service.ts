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

type TokenState = {
  accessToken: string;
  expiresAt: number;
};

@Injectable()
export class FlutterwaveService {
  private tokenState: TokenState | null = null;

  private apiBaseUrl() {
    return (
      process.env.FLUTTERWAVE_API_BASE_URL?.trim() ||
      'https://developersandbox-api.flutterwave.com'
    ).replace(/\/$/, '');
  }

  private clientId() {
    const value = process.env.FLUTTERWAVE_CLIENT_ID?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        'Flutterwave Client ID is not configured',
      );
    }
    return value;
  }

  private clientSecret() {
    const value = process.env.FLUTTERWAVE_CLIENT_SECRET?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        'Flutterwave Client Secret is not configured',
      );
    }
    return value;
  }

  private uniqueId(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.tokenState &&
      this.tokenState.expiresAt > now + 60_000
    ) {
      return this.tokenState.accessToken;
    }

    try {
      const response = await fetch(
        'https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: this.clientId(),
            client_secret: this.clientSecret(),
            grant_type: 'client_credentials',
          }).toString(),
          signal: AbortSignal.timeout(15000),
        },
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.access_token) {
        const message = String(
          payload?.message ??
            payload?.error_description ??
            payload?.error ??
            `Flutterwave authentication failed with status ${response.status}`,
        );
        throw new ServiceUnavailableException(message);
      }

      const expiresIn = Number(payload.expires_in ?? 600);
      this.tokenState = {
        accessToken: String(payload.access_token),
        expiresAt: now + Math.max(60, expiresIn) * 1000,
      };

      return this.tokenState.accessToken;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Unable to authenticate with Flutterwave',
      );
    }
  }

  private async request(path: string, init: RequestInit, retry = true) {
    const token = await this.accessToken();
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Trace-Id', this.uniqueId('pwfb'));

    try {
      const response = await fetch(`${this.apiBaseUrl()}${path}`, {
        ...init,
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json().catch(() => ({}));

      if (response.status === 401 && retry) {
        await this.accessToken(true);
        return this.request(path, init, false);
      }

      if (!response.ok) {
        const validation = Array.isArray(payload?.error?.validation_errors)
          ? payload.error.validation_errors
              .map((item: any) => `${item?.field_name ?? 'field'}: ${item?.message ?? 'invalid'}`)
              .join('; ')
          : '';
        const message = String(
          validation ||
            payload?.error?.message ||
            payload?.message ||
            `Flutterwave request failed with status ${response.status}`,
        );
        throw new ServiceUnavailableException(message);
      }

      return payload as any;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        'Flutterwave service is unavailable',
      );
    }
  }

  async listBanks(country = 'NG'): Promise<FlutterwaveBank[]> {
    const normalizedCountry = String(country || 'NG').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCountry)) {
      throw new BadRequestException('Invalid country code');
    }

    const payload = await this.request(
      `/banks?country=${encodeURIComponent(normalizedCountry)}`,
      { method: 'GET' },
    );
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

  async nameEnquiry(
    bankCode: string,
    accountNumber: string,
  ): Promise<FlutterwaveAccountNameResult> {
    const code = String(bankCode || '').trim();
    const number = String(accountNumber || '').replace(/\D/g, '');
    if (!code) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(number)) {
      throw new BadRequestException('Enter a valid 10-digit account number');
    }

    const payload = await this.request('/banks/account-resolve', {
      method: 'POST',
      body: JSON.stringify({
        account: {
          code,
          number,
        },
        currency: 'NGN',
      }),
    });

    const data = payload?.data ?? {};
    const accountName = String(
      data.account_name ?? data.accountName ?? '',
    ).trim();
    if (!accountName) {
      throw new BadRequestException(
        payload?.message || 'Account name could not be resolved',
      );
    }

    return {
      accountNumber: String(
        data.account_number ?? data.accountNumber ?? number,
      ).replace(/\D/g, ''),
      accountName,
      bankCode: String(data.bank_code ?? data.account_bank ?? code),
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
    if (!/^\d{10}$/.test(accountNumber)) {
      throw new BadRequestException('Enter a valid 10-digit account number');
    }
    if (!accountName) {
      throw new BadRequestException('Verified beneficiary account name is required');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Transfer amount must be greater than zero');
    }
    if (!input.reference) {
      throw new BadRequestException('Transfer reference is required');
    }

    const callbackUrl = process.env.FLUTTERWAVE_CALLBACK_URL?.trim();
    const payload = await this.request('/direct-transfers', {
      method: 'POST',
      headers: {
        'X-Idempotency-Key': input.reference,
      },
      body: JSON.stringify({
        action: 'instant',
        type: 'bank',
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        narration: input.narration.slice(0, 180),
        reference: input.reference,
        payment_instruction: {
          source_currency: 'NGN',
          amount: {
            applies_to: 'destination_currency',
            value: amount,
          },
          recipient: {
            type: 'bank',
            bank: {
              account_number: accountNumber,
              code: bankCode,
            },
          },
          destination_currency: 'NGN',
        },
      }),
    });

    const data = payload?.data ?? {};
    return {
      provider: 'FLUTTERWAVE',
      providerReference: String(data.id ?? data.reference ?? input.reference),
      transactionReference: String(data.reference ?? input.reference),
      status: String(data.status ?? 'NEW').toUpperCase(),
      raw: payload,
    };
  }

  async getTransferStatus(providerReference: string) {
    const id = String(providerReference || '').trim();
    if (!id) {
      throw new BadRequestException('Flutterwave transfer reference is required');
    }
    return this.request(`/transfers/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }
}
