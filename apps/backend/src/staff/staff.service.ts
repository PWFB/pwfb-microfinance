import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { StaffRepository } from './staff.repository';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { FlutterwaveService } from '../banking/flutterwave.service';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

@Injectable()
export class StaffService {
  constructor(private readonly staffRepository: StaffRepository, private readonly flutterwaveService: FlutterwaveService, private readonly prisma: PrismaService) {}
  private normalizeName(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, ''); }
  private async generateLoginEmail(firstName: string, lastName: string) { const base = `${this.normalizeName(firstName)}.${this.normalizeName(lastName)}`; let email = `${base}@pwfb.com`; let counter = 1; while (await this.staffRepository.emailExists(email)) { email = `${base}${counter}@pwfb.com`; counter++; } return email; }
  private generateTemporaryPassword() { return `PWFB-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; }
  private async generateStaffId() { const count = await this.staffRepository.count(); let number = count + 1; let staffId = `PWFB-STF-${String(number).padStart(4, '0')}`; while (await this.staffRepository.staffIdExists(staffId)) { number++; staffId = `PWFB-STF-${String(number).padStart(4, '0')}`; } return staffId; }
  private hashBvn(bvn: string) { return createHash('sha256').update(String(bvn).replace(/\D/g, '')).digest('hex'); }

  private async ensureBvnVerificationTable() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "StaffBvnVerification" ("id" TEXT PRIMARY KEY,"reference" TEXT NOT NULL UNIQUE,"bvnHash" TEXT,"requestedFirstName" TEXT NOT NULL,"requestedLastName" TEXT NOT NULL,"firstName" TEXT,"middleName" TEXT,"lastName" TEXT,"fullName" TEXT,"status" TEXT NOT NULL DEFAULT 'PENDING',"message" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"verifiedAt" TIMESTAMP(3))`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "StaffBvnVerification" ADD COLUMN IF NOT EXISTS "bvnHash" TEXT`);
    await this.prisma.$executeRawUnsafe(`UPDATE "StaffBvnVerification" SET "bvnHash"=encode(digest("bvn", 'sha256'),'hex') WHERE COALESCE("bvnHash",'')='' AND COALESCE("bvn",'')<>''`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "StaffBvnVerification_bvnHash_idx" ON "StaffBvnVerification" ("bvnHash")`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "StaffBvnVerification" DROP COLUMN IF EXISTS "bvn"`);
  }

  async initiateBvnVerification(input: { bvn: string; firstName: string; lastName: string; redirectUrl: string }) {
    const result = await this.flutterwaveService.initiateBvnVerification(input);
    await this.ensureBvnVerificationTable();
    await this.prisma.$executeRawUnsafe(`INSERT INTO "StaffBvnVerification" ("id","reference","bvnHash","requestedFirstName","requestedLastName","status","message") VALUES ($1,$2,$3,$4,$5,'PENDING',$6) ON CONFLICT ("reference") DO UPDATE SET "bvnHash"=EXCLUDED."bvnHash","requestedFirstName"=EXCLUDED."requestedFirstName","requestedLastName"=EXCLUDED."requestedLastName","status"='PENDING',"message"=EXCLUDED."message","updatedAt"=CURRENT_TIMESTAMP`, randomUUID(), result.reference, this.hashBvn(result.bvn), input.firstName.trim(), input.lastName.trim(), result.message ?? 'BVN consent initiated');
    return result;
  }

  async getBvnVerification(reference: string) {
    const ref = String(reference || '').trim(); if (!ref) throw new BadRequestException('BVN verification reference is required');
    await this.ensureBvnVerificationTable();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "reference","status","firstName","middleName","lastName","fullName","message" FROM "StaffBvnVerification" WHERE "reference" = $1 LIMIT 1`, ref); const row = rows[0];
    if (!row) throw new NotFoundException('BVN verification request not found');
    return { verified: row.status === 'COMPLETED', pending: row.status === 'PENDING', reference: row.reference, firstName: row.firstName, middleName: row.middleName, lastName: row.lastName, fullName: row.fullName, status: row.status, message: row.message || '' };
  }

  async handleBvnWebhook(body: any, signature?: string) {
    const secret = String(process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '').trim();
    if (!secret || !signature) throw new BadRequestException('Flutterwave BVN webhook secret hash is not configured');
    const expected = Buffer.from(secret); const received = Buffer.from(String(signature).trim());
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new BadRequestException('Invalid Flutterwave BVN webhook signature');
    const event = String(body?.event ?? body?.event_type ?? body?.type ?? '').toLowerCase();
    if (event !== 'bvn.completed') return { ok: true, ignored: true, event };
    const data = body?.data ?? body?.result ?? {}; const bvnData = data?.bvn_data ?? data?.bvnData ?? data;
    const reference = String(data?.reference ?? data?.verification_reference ?? data?.transaction_reference ?? body?.reference ?? '').trim();
    const bvn = String(bvnData?.bvn ?? data?.bvn ?? '').replace(/\D/g, ''); const status = String(data?.status ?? bvnData?.status ?? 'COMPLETED').toUpperCase();
    const firstName = String(data?.first_name ?? data?.firstname ?? bvnData?.firstName ?? bvnData?.first_name ?? '').trim(); const middleName = String(data?.middle_name ?? data?.middlename ?? bvnData?.middleName ?? bvnData?.middle_name ?? '').trim(); const lastName = String(data?.last_name ?? data?.lastname ?? bvnData?.surname ?? bvnData?.lastName ?? bvnData?.last_name ?? '').trim();
    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim(); const message = String(data?.complete_message ?? data?.message ?? body?.message ?? '').trim();
    await this.ensureBvnVerificationTable(); if (!reference) throw new BadRequestException('Flutterwave BVN webhook did not contain a verification reference');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "StaffBvnVerification" WHERE "reference" = $1 LIMIT 1`, reference); const row = rows[0];
    if (!row) return { ok: true, ignored: true, reason: 'no-matching-pending-request', reference };
    const completed = ['COMPLETED','SUCCESS','SUCCESSFUL'].includes(status) && Boolean(firstName || lastName || fullName); const finalStatus = completed ? 'COMPLETED' : (['FAILED','DECLINED','REJECTED','CANCELLED'].includes(status) ? status : 'PENDING');
    await this.prisma.$executeRawUnsafe(`UPDATE "StaffBvnVerification" SET "bvnHash"=COALESCE(NULLIF($1,''),"bvnHash"),"firstName"=$2,"middleName"=$3,"lastName"=$4,"fullName"=$5,"status"=$6,"message"=$7,"updatedAt"=CURRENT_TIMESTAMP,"verifiedAt"=CASE WHEN $6='COMPLETED' THEN CURRENT_TIMESTAMP ELSE "verifiedAt" END WHERE "id"=$8`, bvn ? this.hashBvn(bvn) : '', firstName || null, middleName || null, lastName || null, fullName || null, finalStatus, message || null, row.id);
    return { ok: true, verified: finalStatus === 'COMPLETED', reference: row.reference, status: finalStatus };
  }

  async verifyBvn(bvn: string) { return this.flutterwaveService.verifyBvn(bvn); }
  async bvnConfigurationStatus() { const primary = String(process.env.FLUTTERWAVE_SECRET_KEY || '').trim(); const fallback = String(process.env.FLW_SECRET_KEY || '').trim(); const webhook = String(process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH || '').trim(); const selected = primary ? 'FLUTTERWAVE_SECRET_KEY' : fallback ? 'FLW_SECRET_KEY' : null; return { configured: Boolean(selected), source: selected, webhookConfigured: Boolean(webhook), environment: process.env.NODE_ENV || 'unknown', api: 'https://api.flutterwave.com/v3/bvn/verifications', secretValueExposed: false }; }
  async create(createStaffDto: CreateStaffDto) { let bvnVerification: any = undefined; let registrationData = { ...createStaffDto }; if (createStaffDto.bvn) throw new BadRequestException('Complete the Flutterwave BVN consent verification before creating this staff account.'); const email = await this.generateLoginEmail(registrationData.firstName, registrationData.lastName); const temporaryPassword = this.generateTemporaryPassword(); const password = await bcrypt.hash(temporaryPassword, 10); const staffId = createStaffDto.staffId || await this.generateStaffId(); try { const result = await this.staffRepository.createWithUser(registrationData, { staffId, email, password }, bvnVerification); return { message: 'Staff created successfully', staff: result.staff, login: { email, temporaryPassword }, bvn: { verified: false } }; } catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Unable to create staff'); } }
  async findAll(filter?: StaffFilterDto) { const staff = await this.staffRepository.findAll(); if (!filter) return staff; return staff.filter((member) => { const departmentMatch = !filter.department || member.department.name === filter.department; const branchMatch = !filter.branch || member.branch.name === filter.branch; const statusMatch = !filter.employmentStatus || member.employmentStatus === filter.employmentStatus; const searchMatch = !filter.search || `${member.firstName} ${member.lastName}`.toLowerCase().includes(filter.search.toLowerCase()); return departmentMatch && branchMatch && statusMatch && searchMatch; }); }
  findOne(id: string) { return this.staffRepository.findOne(id); }
  update(id: string, updateStaffDto: UpdateStaffDto) { return this.staffRepository.update(id, updateStaffDto); }
  remove(id: string) { return this.staffRepository.remove(id); }
  assign(id: string, body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }) { return this.staffRepository.createAssignment(id, body); }
  assignmentHistory(id: string) { return this.staffRepository.assignmentHistory(id); }
}
