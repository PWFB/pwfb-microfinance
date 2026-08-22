import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type NibssNameEnquiryResult = {
  accountNumber: string;
  accountName: string;
};

@Injectable()
export class NibssService {
  async nameEnquiry(
    bankCode: string,
    accountNumber: string,
  ): Promise<NibssNameEnquiryResult> {
    const normalizedBankCode = String(bankCode || '').trim();
    const normalizedAccountNumber = String(accountNumber || '').replace(/\D/g, '');

    if (!normalizedBankCode) {
      throw new BadRequestException('Bank code is required');
    }

    if (!/^\d{10}$/.test(normalizedAccountNumber)) {
      throw new BadRequestException('Enter a valid 10-digit account number');
    }

    const baseUrl = process.env.NIBSS_NAME_ENQUIRY_URL?.trim();
    const clientId = process.env.NIBSS_CLIENT_ID?.trim();

    if (!baseUrl || !clientId) {
      throw new ServiceUnavailableException(
        'NIBSS account name enquiry is not configured',
      );
    }

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    const signature = createHash('sha256').update(nonce).digest('base64');
    const url = new URL(baseUrl);
    url.searchParams.set('bank_code', normalizedBankCode);
    url.searchParams.set('account_number', normalizedAccountNumber);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ClientId: clientId,
        Nonce: nonce,
        Signature: signature,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `NIBSS name enquiry failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as {
      account_number?: string;
      accountNumber?: string;
      account_name?: string;
      accountName?: string;
      message?: string;
    };

    const returnedAccountNumber = String(
      payload.account_number ?? payload.accountNumber ?? normalizedAccountNumber,
    ).replace(/\D/g, '');
    const accountName = String(
      payload.account_name ?? payload.accountName ?? '',
    ).trim();

    if (!accountName) {
      throw new BadRequestException(
        payload.message || 'Account name could not be resolved',
      );
    }

    return {
      accountNumber: returnedAccountNumber,
      accountName,
    };
  }
}
