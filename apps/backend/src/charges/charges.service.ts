import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

type RegistrationPaymentMethod = 'CASH' | 'BANK_TRANSFER';

@Injectable()
export class ChargesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  async ensureTables(db: any = this.prisma) {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PWFBChargeConfiguration" (
        "key" TEXT PRIMARY KEY,
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'NGN',
        "updatedBy" TEXT,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "PWFBChargeChangeAudit" (
        "id" TEXT PRIMARY KEY,
        "chargeKey" TEXT NOT NULL,
        "previousAmount" DOUBLE PRECISION NOT NULL,
        "newAmount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'NGN',
        "reason" TEXT NOT NULL,
        "changedBy" TEXT NOT NULL,
        "changedByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS "PWFBRegistrationChargeReceipt" (
        "id" TEXT PRIMARY KEY,
        "chargeKey" TEXT NOT NULL DEFAULT 'CUSTOMER_REGISTRATION',
        "amount" DOUBLE PRECISION NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'NGN',
        "paymentMethod" TEXT NOT NULL,
        "reference" TEXT NOT NULL UNIQUE,
        "branchId" TEXT NOT NULL REFERENCES "Branch"("id"),
        "staffId" TEXT NOT NULL REFERENCES "Staff"("id"),
        "cashbookEntryId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'COLLECTED',
        "providerVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        "customerId" TEXT UNIQUE REFERENCES "Customer"("id"),
        "usedByStaffId" TEXT REFERENCES "Staff"("id"),
        "createdBy" TEXT NOT NULL,
        "createdByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "usedAt" TIMESTAMP(3)
      );
      ALTER TABLE "PWFBRegistrationChargeReceipt" ADD COLUMN IF NOT EXISTS "usedByStaffId" TEXT REFERENCES "Staff"("id");
      CREATE INDEX IF NOT EXISTS "PWFBRegistrationChargeReceipt_branch_created_idx"
        ON "PWFBRegistrationChargeReceipt" ("branchId", "createdAt" DESC);
      INSERT INTO "PWFBChargeConfiguration" ("key","amount","currency")
        VALUES ('CUSTOMER_REGISTRATION',1500,'NGN')
        ON CONFLICT ("key") DO NOTHING;
    `);
  }

  async getRegistrationCharge() {
    await this.ensureTables();
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "key","amount","currency","updatedBy","updatedAt"
       FROM "PWFBChargeConfiguration" WHERE "key"='CUSTOMER_REGISTRATION' LIMIT 1`,
    );
    const row = rows[0];
    if (!row) throw new NotFoundException('Customer registration charge configuration is missing');
    return {
      key: row.key,
      amount: Number(row.amount),
      currency: row.currency,
      updatedBy: row.updatedBy,
      updatedAt: row.updatedAt,
    };
  }

  async updateRegistrationCharge(amountValue: unknown, reasonValue: unknown, user: any) {
    const amount = Math.round(Number(amountValue) * 100) / 100;
    const reason = String(reasonValue || '').trim();
    const userId = String(user?.id || user?.sub || '').trim();
    if (!userId || String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin may change customer registration charges');
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      throw new BadRequestException('Registration charge must be greater than zero and no more than ₦1,000,000');
    }
    if (reason.length < 8) throw new BadRequestException('A reason of at least 8 characters is required for a charge change');
    await this.ensureTables();

    return this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe(
        'SELECT "key" FROM "PWFBChargeConfiguration" WHERE "key"=$1 FOR UPDATE',
        'CUSTOMER_REGISTRATION',
      );
      const rows = await tx.$queryRawUnsafe(
        `SELECT "amount","currency" FROM "PWFBChargeConfiguration" WHERE "key"=$1 LIMIT 1`,
        'CUSTOMER_REGISTRATION',
      );
      const previous = Number(rows[0]?.amount ?? 1500);
      const currency = String(rows[0]?.currency || 'NGN');
      await tx.$executeRawUnsafe(
        `UPDATE "PWFBChargeConfiguration"
         SET "amount"=$1,"currency"='NGN',"updatedBy"=$2,"updatedAt"=CURRENT_TIMESTAMP
         WHERE "key"='CUSTOMER_REGISTRATION'`,
        amount, userId,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "PWFBChargeChangeAudit"
         ("id","chargeKey","previousAmount","newAmount","currency","reason","changedBy","changedByEmail")
         VALUES ($1,'CUSTOMER_REGISTRATION',$2,$3,$4,$5,$6,$7)`,
        randomUUID(), previous, amount, currency, reason, userId, user?.email || null,
      );
      return { key: 'CUSTOMER_REGISTRATION', previousAmount: previous, amount, currency, reason };
    });
  }

  async listRegistrationChargeAudit(user: any) {
    if (String(user?.role || '').toUpperCase() !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin may view registration charge change history');
    }
    await this.ensureTables();
    return this.prisma.$queryRawUnsafe(
      `SELECT "id","chargeKey","previousAmount","newAmount","currency","reason",
        "changedBy","changedByEmail","createdAt"
       FROM "PWFBChargeChangeAudit" WHERE "chargeKey"='CUSTOMER_REGISTRATION'
       ORDER BY "createdAt" DESC LIMIT 200`,
    );
  }

  async collectRegistrationFee(input: {
    reference: string;
    paymentMethod: RegistrationPaymentMethod;
    confirmedReceived: boolean;
    branchId?: string;
    staffId?: string;
  }, user: any) {
    const reference = String(input?.reference || '').trim();
    const paymentMethod = String(input?.paymentMethod || '').toUpperCase() as RegistrationPaymentMethod;
    const userId = String(user?.id || user?.sub || '').trim();
    if (!userId) throw new ForbiddenException('Authentication required');
    if (!reference || reference.length < 4 || reference.length > 120) {
      throw new BadRequestException('Enter the cash receipt number or bank transfer reference');
    }
    if (!['CASH', 'BANK_TRANSFER'].includes(paymentMethod)) {
      throw new BadRequestException('Registration payment method must be CASH or BANK_TRANSFER');
    }
    if (input.confirmedReceived !== true) {
      throw new BadRequestException('Confirm that the registration charge has actually been received before recording the receipt');
    }
    await this.ensureTables();

    const scope = await this.accessScope.getScope(user);
    let branchId = scope.branchId || '';
    let staffId = scope.staffId || '';
    if (scope.global) {
      branchId = String(input.branchId || '').trim();
      staffId = String(input.staffId || '').trim();
      if (!branchId || !staffId) throw new BadRequestException('Super Admin must select the branch and collecting Staff ID');
      await this.accessScope.assertBranch(user, branchId);
      await this.accessScope.assertStaff(user, staffId);
    }
    if (!branchId || !staffId) {
      throw new ForbiddenException('Your login must be linked to an assigned branch and active Staff ID to collect registration fees');
    }
    if (input.branchId && input.branchId !== branchId && !scope.global) {
      await this.accessScope.assertBranch(user, input.branchId);
      throw new ForbiddenException('Registration fee must be recorded in your assigned branch');
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, branchId: true, employmentStatus: true },
    });
    if (!staff || staff.employmentStatus !== 'ACTIVE' || staff.branchId !== branchId) {
      throw new ForbiddenException('Only an active staff member assigned to the selected branch may collect the fee');
    }

    return this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe(
        'SELECT "key" FROM "PWFBChargeConfiguration" WHERE "key"=$1 FOR SHARE',
        'CUSTOMER_REGISTRATION',
      );
      const configRows = await tx.$queryRawUnsafe(
        `SELECT "amount","currency" FROM "PWFBChargeConfiguration" WHERE "key"=$1 LIMIT 1`,
        'CUSTOMER_REGISTRATION',
      );
      if (!configRows[0]) throw new NotFoundException('Customer registration charge configuration is missing');
      const amount = Number(configRows[0].amount);
      const currency = String(configRows[0].currency || 'NGN');

      const lockKey = `REGISTRATION-FEE:${branchId}:${reference}`;
      await tx.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        lockKey,
      );
      const existing = await tx.$queryRawUnsafe(
        `SELECT "id","amount","currency","paymentMethod","branchId","staffId","status","customerId","cashbookEntryId"
         FROM "PWFBRegistrationChargeReceipt" WHERE "reference"=$1 LIMIT 1`,
        reference,
      );
      if (existing[0]) {
        const receipt = existing[0];
        if (receipt.status === 'COLLECTED' && !receipt.customerId
          && receipt.branchId === branchId
          && receipt.paymentMethod === paymentMethod) {
          return {
            id: receipt.id,
            amount: Number(receipt.amount),
            currency: String(receipt.currency || currency),
            paymentMethod: receipt.paymentMethod,
            reference,
            branchId,
            staffId: receipt.staffId,
            status: 'COLLECTED',
            reused: true,
            providerVerified: false,
          };
        }
        throw new BadRequestException('This registration fee reference has already been used or recorded. Do not reuse a receipt for another customer.');
      }

      const period = await tx.financialPeriod.findFirst({
        where: { status: 'OPEN' },
        orderBy: { startDate: 'desc' },
      });
      if (!period) throw new BadRequestException('No open financial period is available to record the registration fee');
      const now = new Date();
      if (now < new Date(period.startDate) || now > new Date(period.endDate)) {
        throw new BadRequestException('No open financial period currently covers the registration fee collection date');
      }

      const cashbookReference = `REGFEE-${reference}`;
      const priorCashbook = await tx.cashbookEntry.findFirst({
        where: { branchId, reference: cashbookReference },
        select: { id: true },
      });
      if (priorCashbook) throw new BadRequestException('This registration fee reference already exists in the branch cashbook');

      const cashbookEntry = await tx.cashbookEntry.create({
        data: {
          periodId: period.id,
          branchId,
          type: 'CASH_IN',
          amount,
          reference: cashbookReference,
          description: `Customer registration fee collected — receipt ${reference}`,
          entryDate: now,
        },
      });
      const id = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO "PWFBRegistrationChargeReceipt"
         ("id","chargeKey","amount","currency","paymentMethod","reference","branchId","staffId",
          "cashbookEntryId","status","providerVerified","createdBy","createdByEmail")
         VALUES ($1,'CUSTOMER_REGISTRATION',$2,$3,$4,$5,$6,$7,$8,'COLLECTED',FALSE,$9,$10)`,
        id, amount, currency, paymentMethod, reference, branchId, staffId,
        cashbookEntry.id, userId, user?.email || null,
      );
      return {
        id, amount, currency, paymentMethod, reference, branchId, staffId,
        status: 'COLLECTED', reused: false, providerVerified: false,
      };
    });
  }

  async consumeRegistrationReceipt(tx: any, receiptId: string, customerId: string, branchId: string, staffId: string) {
    await this.ensureTables(tx);
    const id = String(receiptId || '').trim();
    if (!id) throw new BadRequestException('A collected registration fee receipt is required before customer creation');
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "PWFBRegistrationChargeReceipt" WHERE "id"=$1 FOR UPDATE',
      id,
    );
    const rows = await tx.$queryRawUnsafe(
      `SELECT "amount","branchId","staffId","status","customerId","reference"
       FROM "PWFBRegistrationChargeReceipt" WHERE "id"=$1 LIMIT 1`,
      id,
    );
    const receipt = rows[0];
    if (!receipt) throw new NotFoundException('Registration fee receipt not found');
    if (receipt.status !== 'COLLECTED' || receipt.customerId) {
      throw new BadRequestException('This registration fee receipt has already been used');
    }
    if (receipt.branchId !== branchId) {
      throw new ForbiddenException('Registration fee receipt must belong to the same branch creating this customer');
    }
    const affected = await tx.$executeRawUnsafe(
      `UPDATE "PWFBRegistrationChargeReceipt"
       SET "status"='USED',"customerId"=$1,"usedByStaffId"=$3,"usedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$2 AND "status"='COLLECTED' AND "customerId" IS NULL`,
      customerId, id, staffId,
    );
    if (Number(affected) !== 1) {
      throw new BadRequestException('Registration fee receipt could not be consumed. It may already be linked to another customer.');
    }
    return { receiptId: id, reference: receipt.reference, amount: Number(receipt.amount), collectedByStaffId: receipt.staffId, registeredByStaffId: staffId };
  }
}
