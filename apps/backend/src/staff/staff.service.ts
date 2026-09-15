import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { StaffRepository } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { createHash, randomUUID } from 'node:crypto';

@Injectable()
export class StaffService {
  constructor(private readonly staffRepository: StaffRepository, private readonly prisma: PrismaService, private readonly paystack: PaystackService) {}
  private normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''); }
  private async generateLoginEmail(firstName: string, lastName: string) { const base = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`; let email = `${base}@pwfb.com`; let counter = 1; while (await this.staffRepository.emailExists(email)) { email = `${base}${counter}@pwfb.com`; counter++; } return email; }
  private generateTemporaryPassword() { return `PWFB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; }
  private async generateStaffId() { const count = await this.staffRepository.count(); let number = count + 1; let staffId = `PWFB-STF-${String(number).padStart(4, '0')}`; while (await this.staffRepository.staffIdExists(staffId)) { number++; staffId = `PWFB-STF-${String(number).padStart(4, '0')}`; } return staffId; }
  private hashBvn(bvn: string) { return createHash('sha256').update(String(bvn).replace(/\D/g, '')).digest('hex'); }

  private async ensureBvnVerificationTable() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "StaffBvnVerification" ("id" TEXT PRIMARY KEY,"reference" TEXT NOT NULL UNIQUE,"bvnHash" TEXT,"requestedFirstName" TEXT NOT NULL,"requestedLastName" TEXT NOT NULL,"firstName" TEXT,"middleName" TEXT,"lastName" TEXT,"fullName" TEXT,"status" TEXT NOT NULL DEFAULT 'PENDING',"message" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"verifiedAt" TIMESTAMP(3))`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "StaffBvnVerification" ADD COLUMN IF NOT EXISTS "bvnHash" TEXT`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StaffBvnVerification_bvnHash_idx" ON "StaffBvnVerification" ("bvnHash")`);
  }

  async paystackBanks() { return this.paystack.listBanks(); }

  async initiateBvnVerification(input: { bvn: string; firstName: string; lastName: string; middleName?: string; bankCode: string; accountNumber: string }) {
    const bvn = String(input.bvn || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(bvn)) throw new BadRequestException('BVN must be exactly 11 digits');
    const firstName = String(input.firstName || '').trim();
    const lastName = String(input.lastName || '').trim();
    if (!firstName || !lastName) throw new BadRequestException('First name and last name are required');
    const account = await this.paystack.resolveAccount(input.bankCode, input.accountNumber);
    const email = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}+kyc${Date.now()}@pwfb.com`;
    const customer = await this.paystack.createCustomer({ email, firstName, lastName });
    const validation = await this.paystack.validateCustomer({ customerCode: customer.customerCode, bvn, firstName, lastName, middleName: input.middleName?.trim(), accountNumber: account.accountNumber, bankCode: account.bankCode });
    await this.ensureBvnVerificationTable();
    await this.prisma.$executeRawUnsafe(`INSERT INTO "StaffBvnVerification" ("id","reference","bvnHash","requestedFirstName","requestedLastName","status","message") VALUES ($1,$2,$3,$4,$5,'PENDING',$6) ON CONFLICT ("reference") DO UPDATE SET "bvnHash"=EXCLUDED."bvnHash","requestedFirstName"=EXCLUDED."requestedFirstName","requestedLastName"=EXCLUDED."requestedLastName","status"='PENDING',"message"=EXCLUDED."message","updatedAt"=CURRENT_TIMESTAMP`, randomUUID(), customer.customerCode, this.hashBvn(bvn), firstName, lastName, validation.message || 'Paystack BVN and bank-account verification in progress');
    return { verified: false, pending: true, reference: customer.customerCode, accountName: account.accountName, bankCode: account.bankCode, accountNumber: account.accountNumber, message: validation.message || 'Paystack accepted the identity verification request. Waiting for verification.' };
  }

  async getBvnVerification(reference: string) {
    const ref = String(reference || '').trim(); if (!ref) throw new BadRequestException('Paystack verification reference is required');
    await this.ensureBvnVerificationTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "reference","status","requestedFirstName","requestedLastName","firstName","middleName","lastName","fullName","message" FROM "StaffBvnVerification" WHERE "reference" = $1 LIMIT 1`, ref); const row = rows[0];
    if (!row) throw new NotFoundException('Paystack BVN verification request not found');
    let firstName = row.firstName || row.requestedFirstName;
    let middleName = row.middleName || '';
    let lastName = row.lastName || row.requestedLastName;
    let fullName = row.fullName || [firstName, middleName, lastName].filter(Boolean).join(' ');

    // Paystack's customer-identification webhook confirms the identity but does not
    // include the customer's unmasked legal name in its event payload. Paystack
    // updates the customer record after successful validation, so fetch that record
    // to populate the actual legal first/middle/last name used by registration.
    if (row.status === 'COMPLETED') {
      try {
        const customer = await this.paystack.getCustomer(ref);
        if (customer.firstName) firstName = customer.firstName;
        if (customer.middleName) middleName = customer.middleName;
        if (customer.lastName) lastName = customer.lastName;
        fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
      } catch (_) {
        // Keep the verified values already stored by the webhook if Paystack is temporarily unavailable.
      }
    }
    return { verified: row.status === 'COMPLETED', pending: row.status === 'PENDING', reference: row.reference, firstName, middleName, lastName, fullName, status: row.status, message: row.message || '' };
  }

  async handleBvnWebhook(body: any, signature?: string, rawBody?: Buffer) {
    const raw = rawBody && Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(body || {}));
    if (!this.paystack.verifyWebhookSignature(raw, signature)) throw new BadRequestException('Invalid Paystack webhook signature');
    const event = String(body?.event || '').toLowerCase();
    if (!['customeridentification.success','customeridentification.failed'].includes(event)) return { ok: true, ignored: true, event };
    const data = body?.data || {};
    const reference = String(data?.customer_code || data?.customerCode || '').trim();
    if (!reference) return { ok: true, ignored: true, reason: 'no-customer-code' };
    await this.ensureBvnVerificationTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "StaffBvnVerification" WHERE "reference" = $1 LIMIT 1`); const row = rows[0];
    if (!row) return { ok: true, ignored: true, reason: 'no-matching-request', reference };
    const failed = event.endsWith('.failed');
    const identification = data?.identification || {};

    let firstName = String(data?.first_name || '').trim();
    let middleName = String(data?.middle_name || '').trim();
    let lastName = String(data?.last_name || '').trim();

    // Paystack's documented customer-identification event contains customer_code
    // and identification details, but not the full unmasked legal name. On success,
    // fetch the customer record, which Paystack updates to the BVN-verified name.
    if (!failed) {
      try {
        const customer = await this.paystack.getCustomer(reference);
        firstName = customer.firstName || firstName;
        middleName = customer.middleName || middleName;
        lastName = customer.lastName || lastName;
      } catch (_) {
        // The verification remains valid; the polling endpoint will retry the fetch.
      }
    }

    const fullName = [firstName,middleName,lastName].filter(Boolean).join(' ').trim();
    const message = failed ? String(data?.reason || 'Paystack identity verification failed') : 'Paystack identity verification completed';
    await this.prisma.$executeRawUnsafe(`UPDATE "StaffBvnVerification" SET "firstName"=$1,"middleName"=$2,"lastName"=$3,"fullName"=$4,"status"=$5,"message"=$6,"updatedAt"=CURRENT_TIMESTAMP,"verifiedAt"=CASE WHEN $5='COMPLETED' THEN CURRENT_TIMESTAMP ELSE "verifiedAt" END WHERE "id"=$7`, firstName || null, middleName || null, lastName || null, fullName || null, failed ? 'FAILED' : 'COMPLETED', message, row.id);
    return { ok: true, verified: !failed, reference, status: failed ? 'FAILED' : 'COMPLETED', bankCode: identification?.bank_code || null };
  }

  async bvnConfigurationStatus() { return { configured: this.paystack.isConfigured(), source: this.paystack.isConfigured() ? 'PAYSTACK_SECRET_KEY' : null, webhookConfigured: this.paystack.isConfigured(), environment: process.env.NODE_ENV || 'unknown', api: 'https://api.paystack.co/customer/:code/identification', secretValueExposed: false }; }

  async create(createStaffDto: CreateStaffDto) {
    const registrationData: any = { ...createStaffDto };
    const reference = String((createStaffDto as any).bvnVerificationReference || '').trim();
    if (!reference) throw new BadRequestException('Complete Paystack BVN and bank-account verification before creating this staff account.');
    const verification = await this.getBvnVerification(reference);
    if (!verification.verified) throw new BadRequestException(verification.message || 'Paystack BVN verification has not completed successfully.');
    delete registrationData.bvn;
    delete registrationData.bvnVerificationReference;
    const email = await this.generateLoginEmail(registrationData.firstName, registrationData.lastName);
    const temporaryPassword = this.generateTemporaryPassword();
    const password = await bcrypt.hash(temporaryPassword, 10);
    const staffId = createStaffDto.staffId || await this.generateStaffId();
    try {
      const result = await this.staffRepository.createWithUser(registrationData, { staffId, email, password }, undefined);
      return { message: 'Staff created successfully', staff: result.staff, login: { email, temporaryPassword }, bvn: { verified: true, provider: 'PAYSTACK', reference } };
    } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Unable to create staff'); }
  }

  async findAll(filter?: StaffFilterDto) { const staff = await this.staffRepository.findAll(); if (!filter) return staff; return staff.filter((member) => { const departmentMatch = !filter.department || member.department.name === filter.department; const branchMatch = !filter.branch || member.branch.name === filter.branch; const statusMatch = !filter.employmentStatus || member.employmentStatus === filter.employmentStatus; const searchMatch = !filter.search || `${member.firstName} ${member.lastName}`.toLowerCase().includes(filter.search.toLowerCase()); return departmentMatch && branchMatch && statusMatch && searchMatch; }); }
  findOne(id: string) { return this.staffRepository.findOne(id); }
  update(id: string, updateStaffDto: UpdateStaffDto) { return this.staffRepository.update(id, updateStaffDto); }
  remove(id: string) { return this.staffRepository.remove(id); }
  assign(id: string, body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }) { return this.staffRepository.createAssignment(id, body); }
  assignmentHistory(id: string) { return this.staffRepository.assignmentHistory(id); }
}
