import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
        data: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', failureReason: 'Awaiting Paystack identity-validation webhook before account assignment' },
      });
      return this.get(customerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack identity verification failed';
      await this.prisma.customerVirtualAccount.update({ where: { id: local.id }, data: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'FAILED', failureReason: reason.slice(0, 500) } });
      await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET bvn_status = 'FAILED', updated_at = NOW() WHERE customer_id = $1`, customerId);
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
    if (existing?.status === 'PENDING' && existing.providerCustomerId) return this.get(customerId);
    if (!existing && !consentConfirmed) throw new BadRequestException('Customer consent is required before creating a Paystack virtual account');
    if (existing && !existing.consentAt && !consentConfirmed) throw new BadRequestException('Customer consent is required before creating a Paystack virtual account');

    const local = existing ?? await this.prisma.customerVirtualAccount.create({
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
      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
        data: { institutionId: institution.id, branchId: customer.branchId ?? null, provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING', consentAt: local.consentAt || new Date(), failureReason: 'Awaiting Paystack identity-validation webhook before account assignment' },
      });
      return this.get(customerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack DVA assignment failed';
      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
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
      const rows = await this.prisma.customerVirtualAccount.findMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode }, select: { customerId: true } });
      for (const row of rows) {
        await this.prisma.$executeRawUnsafe(`UPDATE customer_identity_verifications SET bvn_status = 'FAILED', updated_at = NOW() WHERE customer_id = $1 AND bvn_status = 'PENDING'`, row.customerId);
      }
      await this.prisma.customerVirtualAccount.updateMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason } });
      return { ok: true, processed: true, status: 'FAILED', stage: 'identity' };
    }
    if (type === 'customeridentification.success') {
      const rows = await this.prisma.customerVirtualAccount.findMany({ where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: 'PENDING' }, include: { customer: true } });
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
        where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: { not: 'ACTIVE' } },
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
      where: { provider: 'PAYSTACK', providerCustomerId: customerCode, status: { not: 'ACTIVE' } },
      data: { accountNumber, accountName, providerBankName: bankName, providerReference, status: 'ACTIVE', assignedAt, failureReason: null },
    });
    await this.prisma.staffVirtualAccount.updateMany({
      where: { provider: 'PAYSTACK', providerCustomerCode: customerCode, status: { not: 'ACTIVE' } },
      data: { accountNumber, accountName, bankName, providerAccountId: providerReference, status: 'ACTIVE', assignedAt, failureReason: null },
    });
    return { ok: true, processed: true, status: 'ACTIVE' };
  }
}
