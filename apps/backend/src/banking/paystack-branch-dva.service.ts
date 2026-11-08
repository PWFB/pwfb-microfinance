import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type BranchDvaContact = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  preferredBank?: string;
  bvn?: string;
  bankCode?: string;
  accountNumber?: string;
};

@Injectable()
export class PaystackBranchDvaService {
  private readonly baseUrl = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
  constructor(private readonly prisma: PrismaService) {}

  private secret() {
    const key = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (!key) throw new BadRequestException('PAYSTACK_SECRET_KEY is not configured');
    return key;
  }

  private async request(path: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${this.secret()}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.status) throw new BadRequestException(data?.message || 'Paystack request failed');
    return data;
  }

  private async institution() {
    return this.prisma.bankInstitution.upsert({
      where: { name: 'Paystack' },
      update: { active: true, type: 'PAYMENT_PROVIDER', shortName: 'Paystack' },
      create: { name: 'Paystack', shortName: 'Paystack', type: 'PAYMENT_PROVIDER', active: true },
    });
  }

  async provision(branchId: string, contact: BranchDvaContact) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const email = String(contact?.email || '').trim().toLowerCase();
    const firstName = String(contact?.firstName || '').trim();
    const lastName = String(contact?.lastName || '').trim();
    const phone = String(contact?.phone || '').trim();
    if (!email || !firstName || !lastName || !phone) throw new BadRequestException('Branch Paystack contact email, first name, last name and phone are required');

    const requireIdentity = (process.env.PAYSTACK_DVA_REQUIRE_IDENTITY ?? 'true').toLowerCase() !== 'false';
    if (requireIdentity && (!contact?.bvn || !contact?.bankCode || !contact?.accountNumber)) {
      throw new BadRequestException('Paystack DVA identity validation requires BVN, bank code and bank account number for this financial-services integration');
    }

    const bank = await this.institution();
    let local = await this.prisma.branchVirtualAccount.findFirst({ where: { branchId }, orderBy: { createdAt: 'asc' } });
    if (!local) {
      local = await this.prisma.branchVirtualAccount.create({
        data: { branchId, institutionId: bank.id, accountNumber: `PENDING-${branch.id}-${Date.now()}`, accountName: `PWFB - ${branch.name}`, status: 'INACTIVE', isGenerated: false },
      });
    } else {
      await this.prisma.branchVirtualAccount.update({ where: { id: local.id }, data: { institutionId: bank.id, status: 'INACTIVE' } });
    }

    const saved = await this.prisma.$queryRaw<Array<{ providerCustomerCode: string | null; providerCustomerId: string | null }>>`
      SELECT "providerCustomerCode", "providerCustomerId" FROM "BranchVirtualAccount" WHERE id = ${local.id} LIMIT 1
    `;
    let customerCode = saved[0]?.providerCustomerCode || '';
    let customerId = saved[0]?.providerCustomerId || '';

    if (!customerCode) {
      const customer = await this.request('/customer', { method: 'POST', body: JSON.stringify({
        email, first_name: firstName, last_name: lastName, phone,
        metadata: { pwfbBranchId: branch.id, pwfbBranchName: branch.name, provider: 'PAYSTACK_DVA' },
      }) });
      customerCode = String(customer.data.customer_code);
      customerId = String(customer.data.id);
      await this.prisma.$executeRaw`
        UPDATE "BranchVirtualAccount" SET "provider"='PAYSTACK', "providerCustomerCode"=${customerCode}, "providerCustomerId"=${customerId}, "providerStatus"='CUSTOMER_CREATED', "providerFailureReason"=NULL, "updatedAt"=NOW() WHERE id=${local.id}
      `;
    }

    const payload: Record<string, unknown> = {
      customer: customerCode,
      country: 'NG',
      preferred_bank: contact?.preferredBank || process.env.PAYSTACK_DVA_PREFERRED_BANK || undefined,
    };
    if (contact?.bvn && contact?.bankCode && contact?.accountNumber) Object.assign(payload, { bvn: contact.bvn, bank_code: contact.bankCode, account_number: contact.accountNumber });

    try {
      const result = await this.request('/dedicated_account', { method: 'POST', body: JSON.stringify(payload) });
      const dva = result.data;
      const accountNumber = String(dva?.account_number || '').trim();
      if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Paystack did not return a valid 10-digit virtual account number');
      await this.prisma.$executeRaw`
        UPDATE "BranchVirtualAccount" SET "accountNumber"=${accountNumber}, "accountName"=${String(dva?.account_name || `PWFB - ${branch.name}`)}, "status"='ACTIVE', "isGenerated"=true, "generatedAt"=COALESCE("generatedAt",NOW()), "provider"='PAYSTACK', "providerAccountId"=${String(dva?.id || '') || null}, "providerSlug"=${String(dva?.bank?.slug || '') || null}, "providerBankName"=${String(dva?.bank?.name || '') || null}, "providerStatus"='ACTIVE', "providerFailureReason"=NULL, "updatedAt"=NOW() WHERE id=${local.id}
      `;
      return { ok: true, branchId, branchName: branch.name, provider: 'PAYSTACK', customerCode, accountNumber, accountName: dva?.account_name, bank: dva?.bank };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Paystack DVA assignment failed';
      await this.prisma.$executeRaw`UPDATE "BranchVirtualAccount" SET "provider"='PAYSTACK', "providerStatus"='FAILED', "providerFailureReason"=${reason.slice(0,500)}, "updatedAt"=NOW() WHERE id=${local.id}`;
      throw error;
    }
  }

  async list() {
    return this.prisma.$queryRaw`
      SELECT a.*, b.name AS "branchName", i.name AS "institutionName"
      FROM "BranchVirtualAccount" a JOIN "Branch" b ON b.id=a."branchId" JOIN "BankInstitution" i ON i.id=a."institutionId"
      WHERE a."provider"='PAYSTACK' ORDER BY a."createdAt" DESC
    `;
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) return false;
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8'); const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async handleWebhook(event: any) {
    const type = String(event?.event || ''); const data = event?.data || {};
    if (type === 'dedicatedaccount.assign.failed') {
      const code = String(data?.customer_code || '').trim();
      if (code) await this.prisma.$executeRaw`UPDATE "BranchVirtualAccount" SET "providerStatus"='FAILED', "providerFailureReason"=${String(data?.reason || 'DVA assignment failed').slice(0,500)}, "updatedAt"=NOW() WHERE "provider"='PAYSTACK' AND "providerCustomerCode"=${code}`;
      return { ok: true, processed: true, event: type };
    }
    if (type === 'dedicatedaccount.assign.success') {
      const code = String(data?.customer?.customer_code || data?.customer_code || '').trim();
      const dva = data?.dedicated_account || data;
      const accountNumber = String(dva?.account_number || '').trim();
      if (!code || !/^\d{10}$/.test(accountNumber)) return { ok: true, processed: false, message: 'DVA assignment event has no usable customer code/account number' };
      const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM "BranchVirtualAccount" WHERE "provider"='PAYSTACK' AND "providerCustomerCode"=${code} LIMIT 1`;
      if (!rows[0]) return { ok: true, processed: false, message: 'No PWFB branch mapped to Paystack customer' };
      const accountName = String(dva?.account_name || '').trim();
      await this.prisma.$executeRaw`
        UPDATE "BranchVirtualAccount" SET "accountNumber"=${accountNumber}, "accountName"=COALESCE(NULLIF(${accountName},''),"accountName"), "status"='ACTIVE', "isGenerated"=true, "generatedAt"=COALESCE("generatedAt",NOW()), "provider"='PAYSTACK', "providerAccountId"=${String(dva?.id || '') || null}, "providerSlug"=${String(dva?.bank?.slug || '') || null}, "providerBankName"=${String(dva?.bank?.name || '') || null}, "providerStatus"='ACTIVE', "providerFailureReason"=NULL, "updatedAt"=NOW() WHERE id=${rows[0].id}
      `;
      return { ok: true, processed: true, event: type, accountNumber };
    }
    if (type !== 'charge.success') return { ok: true, processed: false, message: 'Event ignored' };

    const accountNumber = String(data?.authorization?.receiver_bank_account_number || '').trim();
    const channel = String(data?.authorization?.channel || '');
    if (channel !== 'dedicated_nuban' || !/^\d{10}$/.test(accountNumber)) return { ok: true, processed: false, message: 'Not a PWFB dedicated virtual account transfer' };
    const amount = Number(data?.amount) / 100;
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Invalid Paystack charge amount');
    const account = await this.prisma.$queryRaw<Array<{ branchId: string; status: string }>>`SELECT "branchId", status FROM "BranchVirtualAccount" WHERE "provider"='PAYSTACK' AND "accountNumber"=${accountNumber} LIMIT 1`;
    if (!account[0]) return { ok: true, processed: false, message: 'Dedicated account is not mapped to a PWFB branch' };
    if (account[0].status !== 'ACTIVE') throw new BadRequestException('Mapped PWFB branch virtual account is not active');
    const providerReference = String(data?.id || data?.reference || accountNumber);
    const reference = `PAYSTACK-DVA-${providerReference}`;
    if (await this.prisma.cashbookEntry.findFirst({ where: { reference } })) return { ok: true, processed: false, duplicate: true };
    const period = await this.prisma.financialPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    if (!period) throw new BadRequestException('No open financial period is available for the Paystack branch deposit');
    const entry = await this.prisma.cashbookEntry.create({ data: { periodId: period.id, branchId: account[0].branchId, type: 'CASH_IN', amount, reference, description: `Paystack DVA deposit — ${data?.authorization?.sender_name || 'Bank transfer'} — ${accountNumber}` } });
    return { ok: true, processed: true, entryId: entry.id, branchId: account[0].branchId, amount, accountNumber };
  }
}
