import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';

export type NibssTransferStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';

@Injectable()
export class NibssTransferStatusService {
  private config() {
    const clientId = process.env.NIBSS_CLIENT_ID?.trim();
    const clientKey = process.env.NIBSS_CLIENT_KEY?.trim();
    const url = process.env.NIBSS_TRANSACTION_STATUS_URL?.trim();
    if (!clientId || !clientKey || !url) {
      throw new ServiceUnavailableException('NIBSS transaction-status integration is not configured');
    }
    return { clientId, clientKey, url };
  }

  private signature(nonce: string, body: string) {
    return createHash('sha256').update(`${nonce}${body}`).digest('base64');
  }

  async query(xref: string) {
    const reference = String(xref || '').trim();
    if (!reference) throw new BadRequestException('Transfer reference is required');

    const { clientId, clientKey, url } = this.config();
    const body = JSON.stringify({ xref: reference });
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ClientId: clientId,
        Nonce: nonce,
        Signature: this.signature(nonce, body),
      },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new ServiceUnavailableException(String(payload.message || `NIBSS status query failed with status ${response.status}`));
    }

    const raw = String(payload.status ?? payload.transaction_status ?? payload.response_code ?? '').toUpperCase();
    let status: NibssTransferStatus = 'UNKNOWN';
    if (['SUCCESS', 'SUCCESSFUL', '00', 'COMPLETED'].includes(raw)) status = 'SUCCESS';
    else if (['FAILED', 'FAILURE', 'FAILED_TRANSACTION', 'REVERSED', 'REVERSAL'].includes(raw)) status = 'FAILED';
    else if (['PENDING', 'PROCESSING', 'IN_PROGRESS', '01'].includes(raw)) status = 'PENDING';

    return { xref: reference, status, provider: payload };
  }
}
