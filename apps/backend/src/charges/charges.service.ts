import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChargesService {
  private ready: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async ensureTables(db: any = this.prisma) {
    if (db !== this.prisma) {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PWFBChargeSetting" (
          "chargeKey" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "active" BOOLEAN NOT NULL DEFAULT TRUE,
          "updatedBy" TEXT,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "PWFBChargeHistory" (
          "id" TEXT PRIMARY KEY,
          "chargeKey" TEXT NOT NULL,
          "previousAmount" DOUBLE PRECISION,
          "newAmount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "actorId" TEXT,
          "actorEmail" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "PWFBRegistrationFeeReceipt" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE RESTRICT,
          "staffId" TEXT NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT,
          "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
          "amount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
          "reference" TEXT NOT NULL UNIQUE,
          "cashbookEntryId" TEXT NOT NULL UNIQUE REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT,
          "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdByUserId" TEXT,
          "createdByEmail" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "PWFBRegistrationFeeReceipt_branchId_collectedAt_idx" ON "PWFBRegistrationFeeReceipt" ("branchId","collectedAt");
        CREATE INDEX IF NOT EXISTS "PWFBRegistrationFeeReceipt_staffId_collectedAt_idx" ON "PWFBRegistrationFeeReceipt" ("staffId","collectedAt");
        INSERT INTO "PWFBChargeSetting" ("chargeKey","name","amount","currency","active")
        VALUES ('CLIENT_REGISTRATION','Client registration fee',1500,'NGN',TRUE)
        ON CONFLICT ("chargeKey") DO NOTHING;
      `);
      return;
    }
    if (!this.ready) {
      this.ready = this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PWFBChargeSetting" (
          "chargeKey" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "amount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "active" BOOLEAN NOT NULL DEFAULT TRUE,
          "updatedBy" TEXT,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "PWFBChargeHistory" (
          "id" TEXT PRIMARY KEY,
          "chargeKey" TEXT NOT NULL,
          "previousAmount" DOUBLE PRECISION,
          "newAmount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "actorId" TEXT,
          "actorEmail" TEXT,
          "note" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS "PWFBRegistrationFeeReceipt" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL UNIQUE REFERENCES "Customer"("id") ON DELETE RESTRICT,
          "staffId" TEXT NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT,
          "branchId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT,
          "amount" DOUBLE PRECISION NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'NGN',
          "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
          "reference" TEXT NOT NULL UNIQUE,
          "cashbookEntryId" TEXT NOT NULL UNIQUE REFERENCES "CashbookEntry"("id") ON DELETE RESTRICT,
          "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdByUserId" TEXT,
          "createdByEmail" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS "PWFBRegistrationFeeReceipt_branchId_collectedAt_idx" ON "PWFBRegistrationFeeReceipt" ("branchId","collectedAt");
        CREATE INDEX IF NOT EXISTS "PWFBRegistrationFeeReceipt_staffId_collectedAt_idx" ON "PWFBRegistrationFeeReceipt" ("staffId","collectedAt");
        INSERT INTO "PWFBChargeSetting" ("chargeKey","name","amount","currency","active")
        VALUES ('CLIENT_REGISTRATION','Client registration fee',1500,'NGN',TRUE)
        ON CONFLICT ("chargeKey") DO NOTHING;
      `).then(() => undefined).catch(error => { this.ready = null; throw error; });
    }
    await this.ready;
  }

  async getClientRegistrationCharge() {
    await this.ensureTables();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "chargeKey","name","amount","currency","active","updatedAt" FROM "PWFBChargeSetting" WHERE "chargeKey"='CLIENT_REGISTRATION' LIMIT 1`,
    );
    if (!rows[0] || !rows[0].active) throw new BadRequestException('Client registration is temporarily unavailable because its charge is inactive');
    return rows[0];
  }

  async list() {
    await this.ensureTables();
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "chargeKey","name","amount","currency","active","updatedAt" FROM "PWFBChargeSetting" ORDER BY "name"`,
    );
  }

  async history(chargeKey = 'CLIENT_REGISTRATION') {
    await this.ensureTables();
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","chargeKey","previousAmount","newAmount","currency","actorId","actorEmail","note","createdAt" FROM "PWFBChargeHistory" WHERE "chargeKey"=$1 ORDER BY "createdAt" DESC`,
      chargeKey,
    );
  }

  async updateClientRegistrationCharge(amountValue: unknown, note: string, actor: any) {
    const amount = Number(amountValue);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      throw new BadRequestException('Registration charge must be a valid positive NGN amount');
    }
    await this.ensureTables();
    return this.prisma.$transaction(async tx => {
      const current = await tx.$queryRawUnsafe<any[]>(
        `SELECT "amount","currency" FROM "PWFBChargeSetting" WHERE "chargeKey"='CLIENT_REGISTRATION' FOR UPDATE`,
      );
      const previousAmount = current[0] ? Number(current[0].amount) : null;
      await tx.$executeRawUnsafe(
        `INSERT INTO "PWFBChargeSetting" ("chargeKey","name","amount","currency","active","updatedBy","updatedAt")
         VALUES ('CLIENT_REGISTRATION','Client registration fee',$1,'NGN',TRUE,$2,CURRENT_TIMESTAMP)
         ON CONFLICT ("chargeKey") DO UPDATE SET "amount"=$1,"active"=TRUE,"updatedBy"=$2,"updatedAt"=CURRENT_TIMESTAMP`,
        amount, actor?.id || null,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "PWFBChargeHistory" ("id","chargeKey","previousAmount","newAmount","currency","actorId","actorEmail","note")
         VALUES ($1,'CLIENT_REGISTRATION',$2,$3,'NGN',$4,$5,$6)`,
        randomUUID(), previousAmount, amount, actor?.id || null, actor?.email || null, String(note || 'Super Admin updated the registration charge').slice(0, 500),
      );
      return { chargeKey: 'CLIENT_REGISTRATION', name: 'Client registration fee', previousAmount, amount, currency: 'NGN', updatedAt: new Date() };
    });
  }

  async recordClientRegistrationFee(tx: any, input: {
    customerId: string;
    staffId: string;
    branchId: string;
    userId?: string;
    userEmail?: string;
    customerName: string;
    amount: number;
  }) {
    await this.ensureTables(tx);
    const chargeAmount = Number(input.amount);
    if (!Number.isFinite(chargeAmount) || chargeAmount <= 0) throw new BadRequestException('Client registration charge is invalid');
    const existing = await tx.$queryRawUnsafe(
      `SELECT "id" FROM "PWFBRegistrationFeeReceipt" WHERE "customerId"=$1 LIMIT 1`,
      input.customerId,
    );
    if (existing.length) throw new BadRequestException('A registration fee receipt already exists for this customer');
    const period = await tx.financialPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    if (!period) throw new BadRequestException('An open financial period is required to post a client registration fee into the cashbook');
    const reference = `REGFEE-${input.customerId}`;
    const cashbookEntry = await tx.cashbookEntry.create({
      data: {
        periodId: period.id,
        branchId: input.branchId,
        staffId: input.staffId,
        type: 'CASH_IN',
        amount: chargeAmount,
        reference,
        description: `Client registration fee received in cash for ${input.customerName}; registering Staff ID ${input.staffId}`,
        entryDate: new Date(),
      },
    });
    const receiptId = randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "PWFBRegistrationFeeReceipt" ("id","customerId","staffId","branchId","amount","currency","paymentMethod","reference","cashbookEntryId","collectedAt","createdByUserId","createdByEmail")
       VALUES ($1,$2,$3,$4,$5,'NGN','CASH',$6,$7,CURRENT_TIMESTAMP,$8,$9)`,
      receiptId, input.customerId, input.staffId, input.branchId, chargeAmount, reference, cashbookEntry.id, input.userId || null, input.userEmail || null,
    );
    return { id: receiptId, customerId: input.customerId, staffId: input.staffId, branchId: input.branchId, amount: chargeAmount, currency: 'NGN', paymentMethod: 'CASH', reference, cashbookEntryId: cashbookEntry.id, collectedAt: new Date() };
  }

  async listRegistrationReceipts(branchIds?: string[] | null, staffId?: string) {
    await this.ensureTables();
    if (branchIds && !branchIds.length) return [];
    const filters: string[] = [];
    const params: any[] = [];
    if (branchIds) { params.push(branchIds); filters.push(`r."branchId"=ANY($${params.length}::text[])`); }
    if (staffId) { params.push(staffId); filters.push(`r."staffId"=$${params.length}`); }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r."id",r."customerId",r."staffId",r."branchId",r."amount",r."currency",r."paymentMethod",r."reference",r."cashbookEntryId",r."collectedAt",r."createdAt", c."firstName",c."lastName", s."staffId" AS "employeeStaffId",s."firstName" AS "staffFirstName",s."lastName" AS "staffLastName",b."name" AS "branchName"
       FROM "PWFBRegistrationFeeReceipt" r
       JOIN "Customer" c ON c."id"=r."customerId"
       JOIN "Staff" s ON s."id"=r."staffId"
       JOIN "Branch" b ON b."id"=r."branchId"
       ${filters.length ? 'WHERE '+filters.join(' AND ') : ''}
       ORDER BY r."collectedAt" DESC`,
    ...params);
  }

  async getRegistrationReceipt(customerId: string) {
    await this.ensureTables();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT r."id",r."customerId",r."staffId",r."branchId",r."amount",r."currency",r."paymentMethod",r."reference",r."cashbookEntryId",r."collectedAt",s."staffId" AS "employeeStaffId",s."firstName" AS "staffFirstName",s."lastName" AS "staffLastName",b."name" AS "branchName"
       FROM "PWFBRegistrationFeeReceipt" r JOIN "Staff" s ON s."id"=r."staffId" JOIN "Branch" b ON b."id"=r."branchId"
       WHERE r."customerId"=$1 LIMIT 1`,
      customerId,
    );
    return rows[0] || null;
  }
}
