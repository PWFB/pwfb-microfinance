import { BadGatewayException, BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CustomerVirtualAccountView = {
  id: string;
  customerId: string;
  branchId: string | null;
  institutionId: string | null;
  institutionName: string | null;
  institutionShortName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  provider: string | null;
  providerCustomerId?: string | null;
  providerReference: string | null;
  providerBankName: string | null;
  brandName: string;
  status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'INACTIVE';
  requestedAt: Date;
  assignedAt: Date | null;
  failureReason: string | null;
};

@Injectable()
export class CustomerVirtualAccountService {
  private readonly baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';

  constructor(private readonly prisma: PrismaService) {}

  private secret() {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) throw new BadRequestException('PAYSTACK_SECRET_KEY is not configured');
    return key;
  }

  /** Paystack test-mode DVAs require the test-bank provider slug. Never infer a live bank. */
  private preferredBank() {
    const key = String(process.env.PAYSTACK_SECRET_KEY || '').trim();
    // Paystack's documented test-mode DVA provider is test-bank, even if a
    // production provider slug remains configured in the staging environment.
    if (key.startsWith('sk_test_')) return 'test-bank';
    const configured = String(process.env.PAYSTACK_DVA_PREFERRED_BANK || '').trim();
    if (configured) return configured;
    throw new BadRequestException('PAYSTACK_DVA_PREFERRED_BANK must be set to an approved Paystack bank slug');
  }

  private async request(path: string, body?: Record<string, unknown>) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${this.secret()}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (response.status >= 500) throw new BadGatewayException(data?.message || 'Paystack is temporarily unavailable');
    if (!response.ok || !data?.status) throw new BadRequestException(data?.message || 'Paystack DVA assignment failed');
    return data;
  }

  private async paystackInstitution() {
    return this.prisma.bankInstitution.upsert({
      where: { name: 'Paystack' },
      update: { active: true, type: 'PAYMENT_PROVIDER', shortName: 'Paystack' },
      create: { name: 'Paystack', shortName: 'Paystack', type: 'PAYMENT_PROVIDER', active: true },
    });
  }

  private async get(customerId: string): Promise<CustomerVirtualAccountView[]> {
    return this.prisma.$queryRaw<CustomerVirtualAccountView[]> `
      SELECT
        cva."id",
        cva."customerId",
        cva."branchId",
        cva."institutionId",
        bi."name" AS "institutionName",
        bi."shortName" AS "institutionShortName",
        cva."accountNumber",
        cva."accountName",
        cva."provider",
        cva."providerCustomerId",
        cva."providerReference",
        cva."providerBankName",
        'PWFB Microfinance'::text AS "brandName",
        cva."status",
        cva."requestedAt",
        cva."assignedAt",
        cva."failureReason"
      FROM "CustomerVirtualAccount" cva
      LEFT JOIN "BankInstitution" bi ON bi."id" = cva."institutionId"
      WHERE cva."customerId" = ${customerId}
      ORDER BY cva."createdAt" DESC
    `;
  }

  async list(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.get(customerId);
  }

  private maskIdentityValue(value: string) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits ? `${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}` : null;
  }

  async ensureIdentitySchema() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS customer_identity_verifications (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL UNIQUE REFERENCES "Customer"(id) ON DELETE CASCADE,
        bvn TEXT,
        bvn_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
        bvn_verified_at TIMESTAMP,
        bvn_overridden_at TIMESTAMP,
        bvn_override_by_user_id TEXT,
        bvn_override_by_email TEXT,
        bvn_override_reason TEXT,
        nin TEXT,
        nin_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
        nin_verified_at TIMESTAMP,
        nin_overridden_at TIMESTAMP,
        nin_override_by_user_id TEXT,
        nin_override_by_email TEXT,
        nin_override_reason TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS customer_identity_override_audits (
        id TEXT PRIMARY KEY,
        verification_id TEXT NOT NULL REFERENCES customer_identity_verifications(id) ON DELETE CASCADE,
        identity_type TEXT NOT NULL,
        previous_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        reason TEXT NOT NULL,
        admin_user_id TEXT NOT NULL,
        admin_email TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS customer_identity_verification_audits (
        id TEXT PRIMARY KEY,
        customer_id TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE CASCADE,
        identity_type TEXT NOT NULL,
        provider TEXT NOT NULL,
        reference TEXT NOT NULL,
        status TEXT NOT NULL,
        name_match BOOLEAN,
        date_of_birth_match BOOLEAN,
        actor_user_id TEXT,
        actor_email TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_provider TEXT;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_reference TEXT;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_name_match BOOLEAN;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_dob_match BOOLEAN;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_consent_at TIMESTAMP;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS bvn_consent_by_user_id TEXT;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_provider TEXT;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_reference TEXT;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_name_match BOOLEAN;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_dob_match BOOLEAN;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_consent_at TIMESTAMP;
      ALTER TABLE customer_identity_verifications ADD COLUMN IF NOT EXISTS nin_consent_by_user_id TEXT;
    `);
  }

  private normalizeIdentityName(value: unknown) {
    return String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter((part) => part.length > 1);
  }

  private normalizeIdentityDate(value: unknown) {
    const date = String(value || '').trim();
    if (!date) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const dmy = date.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  private async persistIdentityResult(input: {
    customerId: string;
    type: 'BVN' | 'NIN';
    value: string;
    status: 'VERIFIED' | 'MISMATCH' | 'FAILED' | 'UNAVAILABLE';
    reference: string;
    nameMatch: boolean | null;
    dateOfBirthMatch: boolean | null;
    actor: any;
  }) {
    await this.ensureIdentitySchema();
    const prefix = input.type.toLowerCase();
    const maskedValue = this.maskIdentityValue(input.value);
    const previousRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, ${prefix}_status AS status FROM customer_identity_verifications WHERE customer_id = $1 LIMIT 1`,
      input.customerId,
    );
    const previousStatus = String(previousRows[0]?.status || 'NOT_VERIFIED');
    const verifiedAt = input.status === 'VERIFIED' ? new Date() : null;
    const actorId = String(input.actor?.id || input.actor?.sub || '').trim() || null;
    const actorEmail = String(input.actor?.email || '').trim() || null;
    const columns = {
      value: prefix,
      status: `${prefix}_status`,
      verifiedAt: `${prefix}_verified_at`,
      provider: `${prefix}_provider`,
      reference: `${prefix}_reference`,
      nameMatch: `${prefix}_name_match`,
      dobMatch: `${prefix}_dob_match`,
      consentAt: `${prefix}_consent_at`,
      consentBy: `${prefix}_consent_by_user_id`,
    };
    const verificationId = String(previousRows[0]?.id || randomUUID());
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO customer_identity_verifications
        (id, customer_id, ${columns.value}, ${columns.status}, ${columns.verifiedAt},
         ${columns.provider}, ${columns.reference}, ${columns.nameMatch}, ${columns.dobMatch},
         ${columns.consentAt}, ${columns.consentBy}, updated_at)
       VALUES ($1,$2,$3,$4,$5,'DOJAH',$6,$7,$8,NOW(),$9,NOW())
       ON CONFLICT (customer_id) DO UPDATE SET
         ${columns.value}=EXCLUDED.${columns.value},
         ${columns.status}=EXCLUDED.${columns.status},
         ${columns.verifiedAt}=EXCLUDED.${columns.verifiedAt},
         ${columns.provider}=EXCLUDED.${columns.provider},
         ${columns.reference}=EXCLUDED.${columns.reference},
         ${columns.nameMatch}=EXCLUDED.${columns.nameMatch},
         ${columns.dobMatch}=EXCLUDED.${columns.dobMatch},
         ${columns.consentAt}=EXCLUDED.${columns.consentAt},
         ${columns.consentBy}=EXCLUDED.${columns.consentBy},
         updated_at=NOW()`,
      verificationId, input.customerId, maskedValue, input.status, verifiedAt,
      input.reference, input.nameMatch, input.dateOfBirthMatch, actorId,
    );
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO customer_identity_verification_audits
        (id, customer_id, identity_type, provider, reference, status, name_match,
         date_of_birth_match, actor_user_id, actor_email)
       VALUES ($1,$2,$3,'DOJAH',$4,$5,$6,$7,$8,$9)`,
      randomUUID(), input.customerId, input.type, input.reference, input.status,
      input.nameMatch, input.dateOfBirthMatch, actorId, actorEmail,
    );
    return {
      customerId: input.customerId,
      type: input.type,
      status: input.status,
      maskedValue,
      provider: 'DOJAH',
      reference: input.reference,
      nameMatch: input.nameMatch,
      dateOfBirthMatch: input.dateOfBirthMatch,
      previousStatus,
      verifiedAt,
    };
  }

  async verifyCustomerIdentity(customerId: string, type: string, value: string, consentConfirmed: boolean, actor: any) {
    const identityType = String(type || '').toUpperCase();
    if (identityType !== 'BVN' && identityType !== 'NIN') {
      throw new BadRequestException('Identity type must be BVN or NIN');
    }
    if (consentConfirmed !== true) {
      throw new BadRequestException('Confirm that the customer has explicitly consented to this identity check');
    }
    const identifier = String(value || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(identifier)) {
      throw new BadRequestException(`${identityType} must contain exactly 11 digits`);
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, middleName: true, lastName: true, dateOfBirth: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const appId = String(process.env.DOJAH_APP_ID || '').trim();
    const secretKey = String(process.env.DOJAH_SECRET_KEY || '').trim();
    if (!appId || !secretKey) {
      throw new ServiceUnavailableException('DOJAH_APP_ID and DOJAH_SECRET_KEY must be configured before BVN/NIN provider verification can run');
    }
    const environment = String(process.env.DOJAH_ENVIRONMENT || 'sandbox').trim().toLowerCase();
    const configuredBase = String(process.env.DOJAH_API_BASE_URL || '').trim();
    const baseUrl = (configuredBase || (environment === 'live' || environment === 'production'
      ? 'https://api.dojah.io'
      : 'https://sandbox.dojah.io')).replace(/\/$/, '');
    const endpoint = identityType === 'BVN' ? '/api/v1/kyc/bvn/full' : '/api/v1/kyc/nin';
    const parameter = identityType === 'BVN' ? 'bvn' : 'nin';
    const reference = `DOJAH-${identityType}-${randomUUID()}`;

    let payload: any;
    try {
      const response = await fetch(`${baseUrl}${endpoint}?${parameter}=${encodeURIComponent(identifier)}`, {
        method: 'GET',
        headers: { AppId: appId, Authorization: secretKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      payload = await response.json().catch(() => null);
      if (!response.ok) {
        const unavailable = response.status === 401 || response.status === 402 || response.status === 424 || response.status >= 500;
        const result = await this.persistIdentityResult({
          customerId, type: identityType as 'BVN' | 'NIN', value: identifier,
          status: unavailable ? 'UNAVAILABLE' : 'FAILED', reference,
          nameMatch: null, dateOfBirthMatch: null, actor,
        });
        if (unavailable) throw new ServiceUnavailableException('Identity provider is unavailable or not funded. No identity was marked as verified.');
        throw new BadRequestException(`${identityType} could not be verified by the provider. Check the entered number and try again.`);
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException('Identity provider request failed. No identity was marked as verified.');
    }

    const entity = payload?.entity ?? payload?.data?.entity ?? payload?.data ?? null;
    if (!entity || typeof entity !== 'object') {
      await this.persistIdentityResult({
        customerId, type: identityType as 'BVN' | 'NIN', value: identifier,
        status: 'FAILED', reference, nameMatch: false, dateOfBirthMatch: null, actor,
      });
      throw new BadRequestException(`${identityType} was not found in the provider identity registry`);
    }

    const verifiedFirst = entity.first_name ?? entity.firstname ?? entity.firstName;
    const verifiedMiddle = entity.middle_name ?? entity.middlename ?? entity.middleName ?? entity.other_names;
    const verifiedLast = entity.last_name ?? entity.lastname ?? entity.lastName ?? entity.surname;
    const expectedParts = [customer.firstName, customer.middleName, customer.lastName]
      .flatMap((part) => this.normalizeIdentityName(part));
    const distinctExpected = [...new Set(expectedParts)];
    const verifiedParts = new Set([
      ...this.normalizeIdentityName(verifiedFirst),
      ...this.normalizeIdentityName(verifiedMiddle),
      ...this.normalizeIdentityName(verifiedLast),
    ]);
    const matchedNameParts = distinctExpected.filter((part) => verifiedParts.has(part)).length;
    const nameMatch = distinctExpected.length >= 2 && matchedNameParts >= Math.min(2, distinctExpected.length);
    const providerDob = this.normalizeIdentityDate(entity.date_of_birth ?? entity.dob ?? entity.dateOfBirth);
    const customerDob = this.normalizeIdentityDate(customer.dateOfBirth);
    const dateOfBirthMatch = customerDob && providerDob ? customerDob === providerDob : null;
    const passed = nameMatch && dateOfBirthMatch !== false;
    const status = passed ? 'VERIFIED' : 'MISMATCH';
    const result = await this.persistIdentityResult({
      customerId, type: identityType as 'BVN' | 'NIN', value: identifier,
      status, reference, nameMatch, dateOfBirthMatch, actor,
    });
    if (!passed) {
      return {
        ...result,
        message: 'Provider record returned, but the legal name or date of birth did not match the customer profile. Review the customer details; this identity is not verified.',
      };
    }
    return { ...result, message: `${identityType} verified successfully against the provider record.` };
  }

  /**
   * Starts customer identity verification from the registration workflow.
   * BVN is stored only in the existing restricted identity table and is never
   * returned to the frontend or written to logs.
   */
  async startIdentityVerification(customerId: string, input: { bvn: string; bankCode: string; accountNumber: string; consentConfirmed?: boolean }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, branchId: true, firstName: true, middleName: true, lastName: true, email: true, phone: true, user: { select: { email: true } } },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let local = await this.prisma.customerVirtualAccount.findFirst({
      where: { customerId, provider: 'PAYSTACK', status: { in: ['PENDING', 'FAILED', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
    });
    const institution = await this.paystackInstitution();
    if (!local?.consentAt) {
      if (input?.consentConfirmed !== true) throw new BadRequestException('Confirm the customer’s explicit consent before identity verification and virtual-account assignment');
      if (local) {
        local = await this.prisma.customerVirtualAccount.update({ where: { id: local.id }, data: { consentAt: new Date(), institutionId: institution.id, provider: 'PAYSTACK' } });
      } else {
        local = await this.prisma.customerVirtualAccount.create({ data: { id: randomUUID(), customerId, institutionId: institution.id, branchId: customer.branchId ?? null, provider: 'PAYSTACK', consentAt: new Date(), status: 'PENDING' } });
      }
    }
    if (local.status === 'ACTIVE' && local.accountNumber) return this.get(customerId);
    if (local.status === 'PENDING' && local.providerCustomerId && local.failureReason?.includes('Awaiting Paystack identity-validation webhook')) {
      return this.get(customerId);
    }

    const bvn = String(input?.bvn || '').replace(/\D/g, '');
    const bankCode = String(input?.bankCode || '').trim();
    const accountNumber = String(input?.accountNumber || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(bvn)) throw new BadRequestException('BVN must contain exactly 11 digits');
    if (!bankCode) throw new BadRequestException('Select a valid bank');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Bank account number must contain exactly 10 digits');

    const email = String(customer.email ?? customer.user?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) throw new BadRequestException('A valid customer email is required for Paystack identity verification');

    const bank = await this.prisma.bankInstitution.findFirst({
      where: { code: bankCode, active: true },
      select: { id: true, code: true, name: true },
    });
    if (!bank) throw new BadRequestException('The selected bank is not active or has no supported bank code');

    const resolved = await this.request(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    const accountName = String(resolved?.data?.account_name || '').trim();
    if (!accountName) throw new BadRequestException('Paystack could not verify the bank-account name');
    const nameTokens = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((token) => token.length > 1);
    const customerTokens = new Set(nameTokens([customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' ')));
    const matchedTokens = nameTokens(accountName).filter((token) => customerTokens.has(token));
    if (new Set(matchedTokens).size < 2) throw new BadRequestException('The verified bank-account name must match at least two parts of the customer’s legal name');

    let customerCode = String(local.providerCustomerId || '').trim();
    if (!customerCode) {
      const created = await this.request('/customer', {
        email,
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone: customer.phone || undefined,
        metadata: { pwfbCustomerId: customer.id, provider: 'PAYSTACK_DVA', brand: 'PWFB Microfinance' },
      });
      customerCode = String(created?.data?.customer_code || '').trim();
      if (!customerCode) throw new BadRequestException('Paystack did not return a customer code');
    }

    const existingBank = await this.prisma.customerBankAccount.findFirst({ where: { customerId, accountNumber } });
    const hasPrimary = await this.prisma.customerBankAccount.findFirst({ where: { customerId, isPrimary: true } });
    if (existingBank) {
      await this.prisma.customerBankAccount.update({
        where: { id: existingBank.id },
        data: { institutionId: bank.id, accountName, status: 'ACTIVE', verifiedAt: new Date() },
      });
    } else {
      await this.prisma.customerBankAccount.create({
        data: { customerId, institutionId: bank.id, accountNumber, accountName, isPrimary: !hasPrimary, status: 'ACTIVE', verifiedAt: new Date() },
      });
    }

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO customer_identity_verifications (id, customer_id, bvn, bvn_status, updated_at)
       VALUES ($1, $2, $3, 'PENDING', NOW())
       ON CONFLICT (customer_id) DO UPDATE SET bvn = EXCLUDED.bvn, bvn_status = 'PENDING',
       bvn_verified_at = NULL, bvn_overridden_at = NULL, bvn_override_by_user_id = NULL,
       bvn_override_by_email = NULL, bvn_override_reason = NULL, updated_at = NOW()`,
      randomUUID(), customerId, bvn,
    );

    await this.prisma.customerVirtualAccount.update({
      where: { id: local.id },
      data: { institutionId: institution.id, provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', failureReason: 'Submitting customer identity verification to Paystack' },
    });

    try {
      await this.request('/customer/' + encodeURIComponent(customerCode) + '/identification', {
        country: 'NG', type: 'bank_account', account_number: accountNumber, bvn, bank_code: bankCode,
        first_name: customer.firstName, ...(customer.middleName ? { middle_name: customer.middleName } : {}), last_name: customer.lastName,
      });
      // Do not overwrite an ACTIVE/assignment-webhook state if Paystack's
      // webhook arrived before the HTTP response completed.
      await this.prisma.customerVirtualAccount.updateMany({
        where: { id: local.id, status: 'PENDING', failureReason: 'Submitting customer identity verification to Paystack' },
        data: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', failureReason: 'Awaiting Paystack identity-validation webhook before account assignment' },
      });
      return this.get(customerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack identity verification failed';
      await this.prisma.customerVirtualAccount.updateMany({
        where: { id: local.id, status: { not: 'ACTIVE' }, failureReason: 'Submitting customer identity verification to Paystack' },
        data: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
      await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET bvn_status = 'FAILED', updated_at = NOW() WHERE customer_id = $1 AND bvn_status = 'PENDING'`, customerId);
      throw error;
    }
  }

  async ensure(customerId: string, institutionId?: string, consentConfirmed = false) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        branchId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        email: true,
        phone: true,
        user: { select: { email: true } },
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const requestedInstitution = String(institutionId || '').trim();
    if (requestedInstitution) {
      const requested = await this.prisma.bankInstitution.findFirst({
        where: { OR: [{ id: requestedInstitution }, { code: requestedInstitution }] },
        select: { id: true, active: true, name: true },
      });
      if (!requested) throw new NotFoundException('Bank or payment institution not found');
      if (!requested.active) throw new BadRequestException('Bank or payment institution is inactive');
      if (requested.name.toLowerCase() !== 'paystack') {
        throw new BadRequestException('Automatic customer account assignment is currently configured for Paystack only');
      }
    }

    const institution = await this.paystackInstitution();
    const existing = (await this.prisma.customerVirtualAccount.findFirst({
      where: { customerId, provider: 'PAYSTACK', status: { in: ['PENDING', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
    })) ?? (await this.prisma.customerVirtualAccount.findFirst({
      where: { customerId, provider: 'PAYSTACK', status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
    }));

    if (existing?.status === 'ACTIVE' && existing.accountNumber) return this.get(customerId);
    if (existing?.status === 'PENDING' && existing.providerCustomerId) {
      // A pending provider record must not bypass explicit consent. Older records
      // may predate consent capture; require confirmation and persist its audit time.
      if (!existing.consentAt) {
        if (!consentConfirmed) {
          throw new BadRequestException('Customer consent is required before continuing Paystack virtual-account assignment');
        }
        await this.prisma.customerVirtualAccount.update({
          where: { id: existing.id },
          data: { consentAt: new Date() },
        });
      }
      return this.get(customerId);
    }
    if (!existing && !consentConfirmed) throw new BadRequestException('Customer consent is required before creating a Paystack virtual account');
    if (existing && !existing.consentAt && !consentConfirmed) throw new BadRequestException('Customer consent is required before creating a Paystack virtual account');

    let local: any;
    if (existing) {
      local = existing;
      if (!existing.consentAt) {
        // Persist the confirmation even when retrying a previously-created request.
        local = await this.prisma.customerVirtualAccount.update({
          where: { id: existing.id },
          data: { institutionId: institution.id, provider: 'PAYSTACK', consentAt: new Date() },
        });
      }
    } else {
      local = await this.prisma.customerVirtualAccount.create({
        data: {
          id: randomUUID(),
          customerId,
          institutionId: institution.id,
          branchId: customer.branchId ?? null,
          provider: 'PAYSTACK',
          consentAt: new Date(),
          status: 'PENDING',
        },
      });
    }

    const email = String(customer.email ?? customer.user?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      const reason = 'A valid customer email is required for Paystack DVA assignment';
      await this.prisma.customerVirtualAccount.update({ where: { id: local.id }, data: { provider: 'PAYSTACK', status: 'FAILED', failureReason: reason } });
      throw new BadRequestException(reason);
    }

    let customerCode = String(local.providerCustomerId || '').trim();
    try {
      const identityRows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT civ.bvn, civ.bvn_status AS "bvnStatus", cba."accountNumber" AS "accountNumber", bi.code AS "bankCode" FROM customer_identity_verifications civ JOIN "CustomerBankAccount" cba ON cba."customerId" = civ.customer_id JOIN "BankInstitution" bi ON bi.id = cba."institutionId" WHERE civ.customer_id = $1 AND UPPER(COALESCE(civ.bvn_status, \'\')) IN (\'VERIFIED\', \'APPROVED\') AND cba."verifiedAt" IS NOT NULL AND bi.code IS NOT NULL ORDER BY cba."isPrimary" DESC, cba."updatedAt" DESC LIMIT 1',
        customer.id,
      );
      const identity = identityRows[0];
      const bvn = String(identity?.bvn || '').replace(/\D/g, '');
      const verifiedAccountNumber = String(identity?.accountNumber || '').replace(/\D/g, '');
      const bankCode = String(identity?.bankCode || '').trim();
      if (!/^\d{11}$/.test(bvn) || !/^\d{10}$/.test(verifiedAccountNumber) || !bankCode) {
        // Customer registration can finish before KYC/bank verification. Keep the
        // consented request retryable rather than marking it permanently failed.
        // A later retry of ensure() will continue once verified identity data exists.
        const reason = 'Awaiting verified customer BVN and bank-account details before Paystack can assign the virtual account.';
        await this.prisma.customerVirtualAccount.update({
          where: { id: local.id },
          data: {
            status: 'PENDING',
            consentAt: local.consentAt || new Date(),
            failureReason: reason,
          },
        });
        return this.get(customerId);
      }
      if (!customerCode) {
        const created = await this.request('/customer', {
          email,
          first_name: customer.firstName,
          last_name: customer.lastName,
          phone: customer.phone || undefined,
          metadata: { pwfbCustomerId: customer.id, provider: 'PAYSTACK_DVA', brand: 'PWFB Microfinance' },
        });
        customerCode = String(created?.data?.customer_code || '').trim();
        if (!customerCode) throw new BadRequestException('Paystack did not return a customer code');
        // Save the provider customer code before requesting the account, so a retry reuses it.
        await this.prisma.customerVirtualAccount.update({
          where: { id: local.id },
          data: { institutionId: institution.id, branchId: customer.branchId ?? null, provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', failureReason: null },
        });
      }

      const preferredBank = this.preferredBank();
      await this.request('/customer/' + encodeURIComponent(customerCode) + '/identification', {
        country: 'NG', type: 'bank_account', account_number: verifiedAccountNumber, bvn, bank_code: bankCode,
        first_name: customer.firstName, ...(customer.middleName ? { middle_name: customer.middleName } : {}), last_name: customer.lastName,
      });
      await this.prisma.customerVirtualAccount.updateMany({
        where: { id: local.id, status: 'PENDING', failureReason: null },
        data: { institutionId: institution.id, branchId: customer.branchId ?? null, provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', consentAt: local.consentAt || new Date(), failureReason: 'Awaiting Paystack identity-validation webhook before account assignment' },
      });
      return this.get(customerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack DVA assignment failed';
      await this.prisma.customerVirtualAccount.updateMany({
        where: { id: local.id, status: { not: 'ACTIVE' }, failureReason: null },
        data: { provider: 'PAYSTACK', status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
      throw error;
    }
  }

  async ensureStaff(staffId: string, verifiedPaystackCustomerCode: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, staffId: true, firstName: true, lastName: true, employmentStatus: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.employmentStatus !== 'ACTIVE') throw new BadRequestException('A Paystack account is assigned only after staff approval and activation');

    const customerCode = String(verifiedPaystackCustomerCode || '').trim();
    if (!customerCode) throw new BadRequestException('Verified Paystack BVN customer reference is required');

    const institution = await this.paystackInstitution();
    let local = await this.prisma.staffVirtualAccount.findUnique({ where: { staffId } });
    if (local?.status === 'ACTIVE' && local.accountNumber) return this.getStaff(staffId);
    if (local?.status === 'PENDING' && local.failureReason === 'Awaiting Paystack dedicatedaccount.assign.success webhook') return this.getStaff(staffId);

    if (!local) {
      local = await this.prisma.staffVirtualAccount.create({
        data: {
          id: randomUUID(),
          staffId,
          institutionId: institution.id,
          provider: 'PAYSTACK',
          providerCustomerCode: customerCode,
          status: 'PENDING',
        },
      });
    } else {
      if (local.providerCustomerCode && local.providerCustomerCode !== customerCode) {
        throw new BadRequestException('A different verified Paystack customer is already linked to this staff account');
      }
      local = await this.prisma.staffVirtualAccount.update({
        where: { staffId },
        data: { institutionId: institution.id, provider: 'PAYSTACK', providerCustomerCode: customerCode, status: 'PENDING', failureReason: null },
      });
    }

    try {
      const result = await this.request('/dedicated_account', {
        customer: customerCode,
        country: 'NG',
        preferred_bank: this.preferredBank(),
      });
      const dva = result?.data || {};
      const accountNumber = String(dva.account_number || '').trim();
      if (!/^\d{10}$/.test(accountNumber)) {
        // Paystack DVA assignment is asynchronous; do not mark an accepted request failed.
        await this.prisma.staffVirtualAccount.update({ where: { staffId }, data: { status: 'PENDING', failureReason: 'Awaiting Paystack dedicatedaccount.assign.success webhook' } });
        return this.getStaff(staffId);
      }

      await this.prisma.staffVirtualAccount.update({
        where: { staffId },
        data: {
          institutionId: institution.id,
          accountNumber,
          accountName: String(dva.account_name || '').trim() || null,
          bankName: String(dva.bank?.name || '').trim() || null,
          provider: 'PAYSTACK',
          providerCustomerCode: customerCode,
          providerAccountId: String(dva.id ?? '').trim() || null,
          status: 'ACTIVE',
          assignedAt: new Date(),
          failureReason: null,
        },
      });
      return this.getStaff(staffId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack staff DVA assignment failed';
      await this.prisma.staffVirtualAccount.update({
        where: { staffId },
        data: { status: 'FAILED', failureReason: reason.slice(0, 500) },
      });
      throw error;
    }
  }

  async getStaff(staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { id: true } });
    if (!staff) throw new NotFoundException('Staff member not found');
    return this.prisma.staffVirtualAccount.findUnique({ where: { staffId }, include: { institution: true } });
  }

  /**
   * Credits a customer's active Paystack dedicated virtual account after the
   * signed central webhook confirms a successful NGN transfer. Returns
   * matchedCustomerAccount=false when the account belongs to another ledger
   * (for example, a branch DVA) so the controller can route it appropriately.
   */
  async handleDedicatedDepositWebhook(event: any) {
    const eventName = String(event?.event || '').trim().toLowerCase();
    const data = event?.data || {};
    const channel = String(data?.authorization?.channel || '').trim().toLowerCase();
    if (eventName !== 'charge.success' || channel !== 'dedicated_nuban') {
      return { ok: true, processed: false, matchedCustomerAccount: false, message: 'Event is not a dedicated-account deposit' };
    }
    if (String(data?.status || '').trim().toLowerCase() !== 'success') {
      return { ok: true, processed: false, matchedCustomerAccount: false, message: 'Paystack dedicated-account payment is not successful' };
    }

    const accountNumber = String(
      data?.authorization?.receiver_bank_account_number
        || data?.receiver_bank_account_number
        || '',
    ).replace(/\D/g, '');
    if (!/^\d{10}$/.test(accountNumber)) {
      return { ok: true, processed: false, matchedCustomerAccount: false, message: 'Dedicated account number is missing or invalid' };
    }

    const account = await this.prisma.customerVirtualAccount.findFirst({
      where: { provider: 'PAYSTACK', accountNumber, status: 'ACTIVE' },
      select: { id: true, customerId: true, branchId: true },
    });
    if (!account) {
      return { ok: true, processed: false, matchedCustomerAccount: false, message: 'No active customer virtual account matches this payment' };
    }

    const currency = String(data?.currency || '').trim().toUpperCase();
    if (currency !== 'NGN') throw new BadRequestException('Only NGN Paystack virtual-account deposits can be credited');
    const amountMinor = Number(data?.amount);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException('Paystack virtual-account deposit amount must be a positive integer in minor units');
    }
    const paymentReference = String(data?.reference || '').trim();
    if (!paymentReference) throw new BadRequestException('Paystack virtual-account deposit reference is missing');
    const providerTransactionId = String(data?.id ?? paymentReference).trim();
    const amount = amountMinor / 100;
    const transactionReference = `PAYSTACK-DVA-${paymentReference}`;
    const providerReference = `PAYSTACK-DVA-${providerTransactionId}`;

    return this.prisma.$transaction(async (tx) => {
      // Serializes webhook retries and concurrent delivery of the same payment.
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', providerTransactionId);
      const duplicate = await tx.walletTransaction.findFirst({
        where: {
          OR: [
            { reference: transactionReference },
            { reference: `PAY-${paymentReference}` },
            { providerReference },
            { providerReference: providerTransactionId },
          ],
        },
        select: { id: true, reference: true },
      });
      if (duplicate) {
        return {
          ok: true,
          processed: false,
          duplicate: true,
          matchedCustomerAccount: true,
          transactionId: duplicate.id,
          reference: duplicate.reference,
        };
      }

      const wallet = await tx.customerWallet.upsert({
        where: { customerId: account.customerId },
        create: { customerId: account.customerId, balance: 0 },
        update: {},
      });
      // Different Paystack payment references have different advisory locks.
      // Lock the shared wallet row and re-read its balance to prevent concurrent
      // deposits from overwriting one another.
      await tx.$queryRawUnsafe(
        'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
        wallet.id,
      );
      const lockedWallet = await tx.customerWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) throw new BadRequestException('Customer wallet disappeared while crediting Paystack deposit');
      if (lockedWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');

      const previousBalance = Math.round(Number(lockedWallet.balance) * 100) / 100;
      const newBalance = Math.round((previousBalance + amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: lockedWallet.id },
        data: { balance: newBalance },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: account.customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance,
          newBalance,
          reference: transactionReference,
          description: 'Paystack dedicated virtual-account deposit',
          branchId: account.branchId ?? undefined,
          status: 'COMPLETED',
          provider: 'PAYSTACK',
          providerReference,
          processedAt: new Date(),
        },
      });

      return {
        ok: true,
        processed: true,
        matchedCustomerAccount: true,
        wallet: updatedWallet,
        transaction,
      };
    });
  }

  async handleAssignmentWebhook(event: any) {
    const type = String(event?.event || '');
    const data = event?.data || {};
    if (!['dedicatedaccount.assign.success', 'dedicatedaccount.assign.failed', 'customeridentification.success', 'customeridentification.failed'].includes(type)) {
      return { ok: true, ignored: true, event: type };
    }
    const customerCode = String(data?.customer?.customer_code || data?.customer_code || '').trim();
    if (!customerCode) return { ok: true, ignored: true, reason: 'missing-customer-code' };

    if (type === 'customeridentification.failed') {
      const reason = String(data?.reason || 'Paystack customer identity validation failed').slice(0, 500);
      const rows = await this.prisma.customerVirtualAccount.findMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode, consentAt: { not: null } }, select: { customerId: true } });
      for (const row of rows) {
        await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET bvn_status = 'FAILED', updated_at = NOW() WHERE customer_id = $1 AND bvn_status = 'PENDING'`, row.customerId);
      }
      await this.prisma.customerVirtualAccount.updateMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', consentAt: { not: null } }, data: { status: 'FAILED', failureReason: reason } });
      return { ok: true, processed: true, status: 'FAILED', stage: 'identity' };
    }
    if (type === 'customeridentification.success') {
      const rows = await this.prisma.customerVirtualAccount.findMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', consentAt: { not: null } }, include: { customer: true } });
      for (const row of rows) {
        await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET bvn_status = 'VERIFIED', bvn_verified_at = NOW(), updated_at = NOW() WHERE customer_id = $1 AND bvn_status = 'PENDING'`, row.customerId);
      }
      const preferredBank = this.preferredBank();
      let assigned = 0;
      for (const row of rows) {
        if (row.failureReason === 'Awaiting Paystack dedicatedaccount.assign.success webhook') continue;
        const result = await this.request('/dedicated_account', { customer: customerCode, country: 'NG', preferred_bank: preferredBank });
        const dva = result?.data || {};
        const number = String(dva.account_number || '').trim();
        if (!/^\d{10}$/.test(number)) {
          // The API may only acknowledge assignment here; the dedicated-account webhook supplies the account details.
          await this.prisma.customerVirtualAccount.update({ where: { id: row.id }, data: { status: 'PENDING', failureReason: 'Awaiting Paystack dedicatedaccount.assign.success webhook' } });
          continue;
        }
        await this.prisma.customerVirtualAccount.update({ where: { id: row.id }, data: { accountNumber: number, accountName: String(dva.account_name || '').trim() || null, provider: 'PAYSTACK', providerCustomerId: customerCode, providerReference: String(dva.id ?? '').trim() || null, providerBankName: String(dva.bank?.name || '').trim() || null, status: 'ACTIVE', assignedAt: new Date(), failureReason: null } });
        assigned++;
      }
      return { ok: true, processed: true, status: assigned ? 'ACTIVE' : rows.length ? 'PENDING' : 'NO_MATCHING_PENDING_ACCOUNT', stage: 'identity' };
    }

    if (type === 'dedicatedaccount.assign.failed') {
      const reason = String(data?.reason || 'Paystack DVA assignment failed').slice(0, 500);
      await this.prisma.customerVirtualAccount.updateMany({
        where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: { not: 'ACTIVE' }, consentAt: { not: null } },
        data: { status: 'FAILED', failureReason: reason },
      });
      await this.prisma.staffVirtualAccount.updateMany({
        where: { provider: 'PAYSTACK', providerCustomerCode: customerCode, status: { not: 'ACTIVE' } },
        data: { status: 'FAILED', failureReason: reason },
      });
      return { ok: true, processed: true, status: 'FAILED' };
    }

    const dva = data?.dedicated_account || data;
    const accountNumber = String(dva?.account_number || '').trim();
    if (!/^\d{10}$/.test(accountNumber)) return { ok: true, ignored: true, reason: 'invalid-account-number' };
    const accountName = String(dva?.account_name || '').trim() || null;
    const bankName = String(dva?.bank?.name || '').trim() || null;
    const providerReference = String(dva?.id ?? '').trim() || null;
    const assignedAt = new Date();

    await this.prisma.customerVirtualAccount.updateMany({
      where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: { not: 'ACTIVE' }, consentAt: { not: null } },
      data: { accountNumber, accountName, providerBankName: bankName, providerReference, status: 'ACTIVE', assignedAt, failureReason: null },
    });
    await this.prisma.staffVirtualAccount.updateMany({
      where: { provider: 'PAYSTACK', providerCustomerCode: customerCode, status: { not: 'ACTIVE' } },
      data: { accountNumber, accountName, bankName, providerAccountId: providerReference, status: 'ACTIVE', assignedAt, failureReason: null },
    });
    return { ok: true, processed: true, status: 'ACTIVE' };
  }
}
