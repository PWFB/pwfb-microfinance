import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type NibssNameEnquiryResult = { accountNumber: string; accountName: string };

@Injectable()
export class NibssService {
  private config() {
    const clientId = process.env.NIBSS_CLIENT_ID?.trim();
    const clientKey = process.env.NIBSS_CLIENT_KEY?.trim();
    if (!clientId || !clientKey) throw new ServiceUnavailableException('NIBSS integration is not configured');
    return { clientId, clientKey };
  }

  private signature(nonce: string, body: string, clientKey: string) {
    return createHash('sha256').update(`${nonce}${body}${clientKey}`).digest('base64');
  }

  async nameEnquiry(bankCode: string, accountNumber: string): Promise<NibssNameEnquiryResult> {
    const normalizedBankCode = String(bankCode || '').trim();
    const normalizedAccountNumber = String(accountNumber || '').replace(/\D/g, '');
    if (!normalizedBankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(normalizedAccountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');

    const baseUrl = process.env.NIBSS_NAME_ENQUIRY_URL?.trim();
    const { clientId, clientKey } = this.config();
    if (!baseUrl) throw new ServiceUnavailableException('NIBSS name enquiry is not configured');

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const url = new URL(baseUrl);
    url.searchParams.set('bank_code', normalizedBankCode);
    url.searchParams.set('account_number', normalizedAccountNumber);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ClientId: clientId, Nonce: nonce, Signature: this.signature(nonce, '', clientKey) },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ServiceUnavailableException(`NIBSS name enquiry failed with status ${response.status}`);
    const payload = await response.json() as { account_number?: string; accountNumber?: string; account_name?: string; accountName?: string; message?: string };
    const returnedAccountNumber = String(payload.account_number ?? payload.accountNumber ?? normalizedAccountNumber).replace(/\D/g, '');
    const accountName = String(payload.account_name ?? payload.accountName ?? '').trim();
    if (!accountName) throw new BadRequestException(payload.message || 'Account name could not be resolved');
    return { accountNumber: returnedAccountNumber, accountName };
  }

  async transfer(input: { bankCode: string; accountNumber: string; amount: number; narration: string; xref: string }) {
    const bankCode = String(input.bankCode || '').trim();
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    if (!bankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    if (!input.xref) throw new BadRequestException('Transfer reference is required');

    const baseUrl = process.env.NIBSS_TRANSFER_URL?.trim();
    const { clientId, clientKey } = this.config();
    if (!baseUrl) throw new ServiceUnavailableException('NIBSS bank transfer is not configured');
    const body = JSON.stringify({ xref: input.xref, bank_code: bankCode, account_number: accountNumber, amount: input.amount.toFixed(2), narration: input.narration.slice(0, 100) });
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ClientId: clientId, Nonce: nonce, Signature: this.signature(nonce, body, clientKey) },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new ServiceUnavailableException(String(payload.message || `NIBSS transfer failed with status ${response.status}`));
    return payload;
  }
}
