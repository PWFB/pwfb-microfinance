import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type FlutterwaveAccountNameResult = { accountNumber: string; accountName: string; bankCode: string };
export type FlutterwaveBank = { id: string; code: string; name: string };
type TokenState = { accessToken: string; expiresAt: number };
type BvnVerificationResult = { verified: boolean; pending: boolean; bvn: string; reference?: string; consentUrl?: string | null; firstName?: string | null; middleName?: string | null; lastName?: string | null; fullName?: string; status?: string; message?: string; raw?: unknown };

@Injectable()
export class FlutterwaveService {
  private tokenState: TokenState | null = null;
  private apiBaseUrl() { return (process.env.FLUTTERWAVE_API_BASE_URL?.trim() || 'https://api.flutterwave.com').replace(/\/$/, ''); }
  private isSandbox() { return /sandbox/i.test(this.apiBaseUrl()); }
  private clientId() { const value = process.env.FLUTTERWAVE_CLIENT_ID?.trim(); if (!value) throw new ServiceUnavailableException('Flutterwave Client ID is not configured'); return value; }
  private clientSecret() { const value = process.env.FLUTTERWAVE_CLIENT_SECRET?.trim(); if (!value) throw new ServiceUnavailableException('Flutterwave Client Secret is not configured'); return value; }
  private secretKey() { const value = (process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY || '').trim(); if (!value) throw new ServiceUnavailableException('Flutterwave Secret Key is not configured for legacy account verification'); return value; }
  private uniqueId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }

  private async accessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.tokenState && this.tokenState.expiresAt > now + 60_000) return this.tokenState.accessToken;
    try {
      const response = await fetch('https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: this.clientId(), client_secret: this.clientSecret(), grant_type: 'client_credentials' }).toString(), signal: AbortSignal.timeout(15000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.access_token) throw new ServiceUnavailableException(String(payload?.message ?? payload?.error_description ?? payload?.error ?? `Flutterwave authentication failed with status ${response.status}`));
      const expiresIn = Number(payload.expires_in ?? 600); this.tokenState = { accessToken: String(payload.access_token), expiresAt: now + Math.max(60, expiresIn) * 1000 }; return this.tokenState.accessToken;
    } catch (error) { if (error instanceof ServiceUnavailableException) throw error; throw new ServiceUnavailableException('Unable to authenticate with Flutterwave'); }
  }

  private async request(path: string, init: RequestInit, retry = true) {
    const token = await this.accessToken(); const headers = new Headers(init.headers); headers.set('Accept', 'application/json'); headers.set('Content-Type', 'application/json'); headers.set('Authorization', `Bearer ${token}`); headers.set('X-Trace-Id', this.uniqueId('pwfb'));
    try {
      const response = await fetch(`${this.apiBaseUrl()}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) }); const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && retry) { await this.accessToken(true); return this.request(path, init, false); }
      if (!response.ok) { const validation = Array.isArray(payload?.error?.validation_errors) ? payload.error.validation_errors.map((item: any) => `${item?.field_name ?? 'field'}: ${item?.message ?? 'invalid'}`).join('; ') : ''; const error: any = new ServiceUnavailableException(String(validation || payload?.error?.message || payload?.message || `Flutterwave request failed with status ${response.status}`)); error.statusCode = response.status; throw error; }
      return payload as any;
    } catch (error) { if (error instanceof ServiceUnavailableException) throw error; throw new ServiceUnavailableException('Flutterwave service is unavailable'); }
  }

  private async legacyAccountResolve(bankCode: string, accountNumber: string): Promise<FlutterwaveAccountNameResult> {
    const code = String(bankCode || '').trim(); const number = String(accountNumber || '').replace(/\D/g, '');
    const response = await fetch('https://api.flutterwave.com/v3/accounts/resolve', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey()}`, 'X-Trace-Id': this.uniqueId('pwfb-v3-resolve') }, body: JSON.stringify({ account_number: number, account_bank: code }), signal: AbortSignal.timeout(15000) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new ServiceUnavailableException(String(payload?.message || payload?.error?.message || `Flutterwave account verification failed with status ${response.status}`));
    const data = payload?.data ?? {};
    const accountName = String(data.account_name ?? data.accountName ?? '').trim();
    const returnedNumber = String(data.account_number ?? data.accountNumber ?? '').replace(/\D/g, '');
    if (!accountName) throw new BadRequestException(payload?.message || 'Account name could not be resolved');
    if (!returnedNumber || returnedNumber !== number) throw new BadRequestException('Bank provider did not return the exact account number entered. Verification was rejected.');
    return { accountNumber: returnedNumber, accountName, bankCode: code };
  }

  private async bvnRequest(path: string, init: RequestInit) {
    const headers = new Headers(init.headers); headers.set('Accept', 'application/json'); headers.set('Content-Type', 'application/json'); headers.set('Authorization', `Bearer ${this.secretKey()}`); headers.set('X-Trace-Id', this.uniqueId('pwfb-bvn'));
    try { const response = await fetch(`https://api.flutterwave.com/v3${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw new BadRequestException(String(payload?.error?.message || payload?.message || `Flutterwave BVN request failed with status ${response.status}`)); return payload as any; } catch (error) { if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error; throw new ServiceUnavailableException('Flutterwave BVN service is unavailable'); }
  }

  async initiateBvnVerification(input: { bvn: string; firstName: string; lastName: string; redirectUrl: string }) { const value = String(input.bvn || '').replace(/\D/g, ''); const firstName = String(input.firstName || '').trim(); const lastName = String(input.lastName || '').trim(); const redirectUrl = String(input.redirectUrl || '').trim(); if (!/^\d{11}$/.test(value)) throw new BadRequestException('BVN must be exactly 11 digits'); if (!firstName || !lastName) throw new BadRequestException('First name and last name are required to request BVN consent'); if (!redirectUrl) throw new BadRequestException('BVN redirect URL is required'); const payload = await this.bvnRequest('/bvn/verifications', { method: 'POST', body: JSON.stringify({ bvn: value, firstname: firstName, lastname: lastName, redirect_url: redirectUrl }) }); const data = payload?.data ?? {}; const reference = String(data.reference ?? '').trim(); if (!reference) throw new ServiceUnavailableException('Flutterwave did not return a BVN verification reference'); return { verified: false, pending: true, bvn: value, reference, consentUrl: data.url == null ? null : String(data.url), message: String(payload?.message || 'BVN consent initiated') } satisfies BvnVerificationResult; }
  async getBvnVerification(reference: string): Promise<BvnVerificationResult> { const ref = String(reference || '').trim(); if (!ref) throw new BadRequestException('BVN verification reference is required'); const payload = await this.bvnRequest(`/bvn/verifications/${encodeURIComponent(ref)}?include_complete_message=1`, { method: 'GET' }); const data = payload?.data ?? {}; const bvnData = data?.bvn_data ?? {}; const status = String(data?.status ?? bvnData?.status ?? '').trim().toUpperCase(); const firstName = String(data?.first_name ?? data?.firstname ?? bvnData?.firstName ?? bvnData?.first_name ?? '').trim(); const middleName = String(data?.middle_name ?? data?.middlename ?? bvnData?.middleName ?? bvnData?.middle_name ?? '').trim(); const lastName = String(data?.last_name ?? data?.lastname ?? bvnData?.surname ?? bvnData?.lastName ?? bvnData?.last_name ?? '').trim(); const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim(); const verified = status === 'COMPLETED' && Boolean(fullName); const pending = !verified && !['FAILED', 'DECLINED', 'REJECTED', 'CANCELLED'].includes(status); return { verified, pending, bvn: String(bvnData?.bvn ?? data?.bvn ?? ''), reference: ref, firstName: firstName || null, middleName: middleName || null, lastName: lastName || null, fullName: fullName || undefined, status, message: String(data?.complete_message ?? payload?.message ?? ''), raw: payload }; }
  async verifyBvn(bvn: string) { throw new BadRequestException('BVN verification now requires customer consent. Start the consent verification flow instead.'); }
  async createCustomer(input: { email: string; firstName: string; lastName: string; phone?: string | null }) { const email = String(input.email || '').trim(); const firstName = String(input.firstName || '').trim(); const lastName = String(input.lastName || '').trim(); if (!email) throw new BadRequestException('Customer email is required for Flutterwave'); if (!firstName || !lastName) throw new BadRequestException('Customer first and last names are required for Flutterwave'); const payload = await this.request('/customers', { method: 'POST', headers: { 'X-Idempotency-Key': this.uniqueId('customer') }, body: JSON.stringify({ email, name: { first: firstName, last: lastName }, ...(input.phone ? { phone: { country_code: '234', number: String(input.phone).replace(/\D/g, '').replace(/^234/, '') } } : {}) }) }); const id = String(payload?.data?.id ?? '').trim(); if (!id) throw new ServiceUnavailableException('Flutterwave customer was created without a customer ID'); return { id, raw: payload }; }
  async createStaticVirtualAccount(input: { customerId: string; reference: string; narration: string; bankCode?: string; bvn?: string; nin?: string }) { const customerId = String(input.customerId || '').trim(); const reference = String(input.reference || '').trim(); if (!customerId) throw new BadRequestException('Flutterwave customer ID is required'); if (!reference) throw new BadRequestException('Virtual account reference is required'); const bankCode = String(input.bankCode || process.env.FLUTTERWAVE_VIRTUAL_ACCOUNT_BANK_CODE || '090567').trim(); const payload: Record<string, unknown> = { reference, customer_id: customerId, amount: 0, currency: 'NGN', bank_code: bankCode, account_type: 'static', narration: String(input.narration || '').slice(0, 100) }; if (input.bvn) payload.bvn = String(input.bvn).replace(/\D/g, ''); if (input.nin) payload.nin = String(input.nin).replace(/\D/g, ''); const response = await this.request('/virtual-accounts', { method: 'POST', headers: { 'X-Idempotency-Key': reference }, body: JSON.stringify(payload) }); const data = response?.data ?? {}; const accountNumber = String(data.account_number ?? data.accountNumber ?? '').replace(/\D/g, ''); if (!accountNumber) throw new ServiceUnavailableException('Flutterwave did not return a virtual account number'); return { accountNumber, accountName: String(data.account_name ?? data.accountName ?? input.narration ?? '').trim() || null, bankName: String(data.bank_name ?? data.bankName ?? '').trim() || null, providerReference: String(data.reference ?? data.id ?? response?.reference ?? reference).trim(), bankCode: String(data.bank_code ?? bankCode).trim(), raw: response }; }
  async listBanks(country = 'NG'): Promise<FlutterwaveBank[]> { const normalizedCountry = String(country || 'NG').trim().toUpperCase(); if (!/^[A-Z]{2}$/.test(normalizedCountry)) throw new BadRequestException('Invalid country code'); const payload = await this.request(`/banks?country=${encodeURIComponent(normalizedCountry)}`, { method: 'GET' }); const banks = Array.isArray(payload?.data) ? payload.data : []; return banks.map((bank: any) => { const code = String(bank?.code ?? bank?.bank_code ?? '').trim(); const name = String(bank?.name ?? bank?.bank_name ?? '').trim(); const providerId = String(bank?.id ?? code).trim(); return { id: providerId || code, code, name }; }).filter((bank: FlutterwaveBank) => Boolean(bank.code && bank.name)); }
  async nameEnquiry(bankCode: string, accountNumber: string): Promise<FlutterwaveAccountNameResult> {
    const code = String(bankCode || '').trim(); const number = String(accountNumber || '').replace(/\D/g, '');
    if (!code) throw new BadRequestException('Bank code is required'); if (!/^\d{10}$/.test(number)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (this.isSandbox() && process.env.ALLOW_SANDBOX_BANK_VERIFICATION !== 'true') throw new BadRequestException('Real bank account verification is disabled while Flutterwave sandbox is configured. Set the Render Flutterwave API base URL to production before verifying real accounts.');
    if (!this.isSandbox() && (process.env.FLUTTERWAVE_SECRET_KEY?.trim() || process.env.FLW_SECRET_KEY?.trim())) {
      try { return await this.legacyAccountResolve(code, number); } catch (error) {
        if (error instanceof BadRequestException) throw error;
        // If the legacy v3 resolver is unavailable, fall through to the current v4 resolver.
      }
    }
    const payload = await this.request('/banks/account-resolve', { method: 'POST', body: JSON.stringify({ account: { code, number }, currency: 'NGN' }) }); const data = payload?.data ?? {};
    const accountName = String(data.account_name ?? data.accountName ?? '').trim(); const returnedNumber = String(data.account_number ?? data.accountNumber ?? '').replace(/\D/g, ''); const returnedCode = String(data.bank_code ?? data.account_bank ?? '').trim();
    if (!accountName) throw new BadRequestException(payload?.message || 'Account name could not be resolved');
    if (!returnedNumber || returnedNumber !== number) throw new BadRequestException('Bank provider did not return the exact account number entered. Verification was rejected.');
    if (returnedCode && returnedCode !== code) throw new BadRequestException('Bank provider returned a different bank code. Verification was rejected.');
    return { accountNumber: returnedNumber, accountName, bankCode: returnedCode || code };
  }
  async transfer(input: { bankCode: string; accountNumber: string; accountName: string; amount: number; narration: string; reference: string }) { const bankCode = String(input.bankCode || '').trim(); const accountNumber = String(input.accountNumber || '').replace(/\D/g, ''); const accountName = String(input.accountName || '').trim(); const amount = Math.round(Number(input.amount) * 100) / 100; if (!bankCode) throw new BadRequestException('Bank code is required'); if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number'); if (!accountName) throw new BadRequestException('Verified beneficiary account name is required'); if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero'); if (!input.reference) throw new BadRequestException('Transfer reference is required'); const callbackUrl = process.env.FLUTTERWAVE_CALLBACK_URL?.trim(); const payload = await this.request('/direct-transfers', { method: 'POST', headers: { 'X-Idempotency-Key': input.reference }, body: JSON.stringify({ action: 'instant', type: 'bank', ...(callbackUrl ? { callback_url: callbackUrl } : {}), narration: input.narration.slice(0, 180), reference: input.reference, payment_instruction: { source_currency: 'NGN', amount: { applies_to: 'destination_currency', value: amount }, recipient: { type: 'bank', bank: { account_number: accountNumber, code: bankCode } }, destination_currency: 'NGN' } }) }); const data = payload?.data ?? {}; return { provider: 'FLUTTERWAVE', providerReference: String(data.id ?? data.reference ?? input.reference), transactionReference: String(data.reference ?? input.reference), status: String(data.status ?? 'NEW').toUpperCase(), raw: payload }; }
  async getTransferStatus(providerReference: string) { const id = String(providerReference || '').trim(); if (!id) throw new BadRequestException('Flutterwave transfer reference is required'); return this.request(`/transfers/${encodeURIComponent(id)}`, { method: 'GET' }); }
}
