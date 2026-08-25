import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FlutterwaveService } from './flutterwave.service';

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
  status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'INACTIVE';
  requestedAt: Date;
  assignedAt: Date | null;
  failureReason: string | null;
};

@Injectable()
export class CustomerVirtualAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flutterwave: FlutterwaveService,
  ) {}

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
        cva."providerCustomerId",
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
      select: {
        id: true,
        branchId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        user: { select: { email: true } },
      },
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

    const existing = await this.prisma.customerVirtualAccount.findFirst({
      where: {
        customerId,
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing?.status === 'ACTIVE' && existing.accountNumber) {
      return this.get(customerId);
    }

    const local = existing
      ? existing
      : await this.prisma.customerVirtualAccount.create({
          data: {
            id: randomUUID(),
            customerId,
            institutionId: institutionId ?? null,
            branchId: customer.branchId ?? null,
            accountName: `${customer.firstName} ${customer.lastName}`.trim(),
            status: 'PENDING',
          },
        });

    const email = String(customer.email ?? customer.user?.email ?? '').trim();
    if (!email) {
      const reason = 'Customer email is required to create a Flutterwave virtual account';
      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
        data: { status: 'FAILED', failureReason: reason },
      });
      throw new BadRequestException(reason);
    }

    const narration = `${customer.firstName} ${customer.lastName}`.trim();
    const reference = `pwfb-va-${customer.id}-${local.id}`;

    try {
      // Flutterwave's current API requires a Flutterwave customer before the
      // virtual account can be attached to that customer.
      const providerCustomer = existing?.providerCustomerId
        ? { id: existing.providerCustomerId }
        : await this.flutterwave.createCustomer({
            email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            phone: customer.phone,
          });

      const virtualAccount = await this.flutterwave.createStaticVirtualAccount({
        customerId: providerCustomer.id,
        reference,
        narration,
      });

      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
        data: {
          institutionId: institutionId ?? local.institutionId,
          branchId: customer.branchId ?? local.branchId,
          accountNumber: virtualAccount.accountNumber,
          accountName: virtualAccount.accountName ?? narration,
          provider: 'FLUTTERWAVE',
          providerCustomerId: providerCustomer.id,
          providerReference: virtualAccount.providerReference,
          status: 'ACTIVE',
          assignedAt: new Date(),
          failureReason: null,
        },
      });

      return this.get(customerId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Flutterwave virtual account creation failed';
      await this.prisma.customerVirtualAccount.update({
        where: { id: local.id },
        data: {
          provider: 'FLUTTERWAVE',
          status: 'FAILED',
          failureReason: reason.slice(0, 500),
        },
      });
      throw error;
    }
  }
}
