import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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
  providerReference: string | null;
  status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'INACTIVE';
  requestedAt: Date;
  assignedAt: Date | null;
  failureReason: string | null;
};

@Injectable()
export class CustomerVirtualAccountService {
  constructor(private readonly prisma: PrismaService) {}

  private async get(customerId: string): Promise<CustomerVirtualAccountView[]> {
    return this.prisma.$queryRaw<CustomerVirtualAccountView[]>`
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
        cva."providerReference",
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
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');
    return this.get(customerId);
  }

  async ensure(customerId: string, institutionId?: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, branchId: true, firstName: true, lastName: true },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    if (institutionId) {
      const institution = await this.prisma.bankInstitution.findUnique({
        where: { id: institutionId },
        select: { id: true, active: true },
      });
      if (!institution) throw new NotFoundException('Bank or payment institution not found');
      if (!institution.active) throw new BadRequestException('Bank or payment institution is inactive');
    }

    const existing = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "CustomerVirtualAccount"
      WHERE "customerId" = ${customerId}
        AND "status" IN ('PENDING', 'ACTIVE')
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    if (existing.length === 0) {
      await this.prisma.$executeRaw`
        INSERT INTO "CustomerVirtualAccount"
          ("id", "customerId", "institutionId", "branchId", "accountName", "status", "requestedAt", "createdAt", "updatedAt")
        VALUES
          (${randomUUID()}, ${customerId}, ${institutionId ?? null}, ${customer.branchId ?? null}, ${`${customer.firstName} ${customer.lastName}`}, 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
    }

    return this.get(customerId);
  }
}
