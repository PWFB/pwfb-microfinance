import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVirtualAccountInput, VIRTUAL_ACCOUNT_PROVIDER, VirtualAccountProvider } from './virtual-accounts.types';

@Injectable()
export class VirtualAccountsService {
  private readonly logger = new Logger(VirtualAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(VIRTUAL_ACCOUNT_PROVIDER)
    private readonly provider: VirtualAccountProvider,
  ) {}

  async provision(input: CreateVirtualAccountInput) {
    const existing = await this.findByCustomer(input.customerId);
    if (existing?.status === 'ACTIVE') return existing;

    await this.prisma.$executeRaw`
      INSERT INTO "CustomerVirtualAccount"
        ("id", "customerId", "branchId", "provider", "status", "isPrimary", "createdAt", "updatedAt")
      VALUES
        (${`cva-${input.customerId}`}, ${input.customerId}, ${input.branchId}, 'PAYSTACK', 'PENDING', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("customerId") DO UPDATE SET
        "branchId" = EXCLUDED."branchId",
        "updatedAt" = CURRENT_TIMESTAMP
    `;

    try {
      const account = await this.provider.createVirtualAccount(input);

      await this.prisma.$executeRaw`
        UPDATE "CustomerVirtualAccount"
        SET "accountNumber" = ${account.accountNumber},
            "accountName" = ${account.accountName},
            "bankName" = ${account.bankName},
            "bankCode" = ${account.bankCode ?? null},
            "providerReference" = ${account.providerReference},
            "provider" = 'PAYSTACK',
            "status" = 'ACTIVE',
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "customerId" = ${input.customerId}
      `;

      this.logger.log(`Virtual account provisioned for customer ${input.customerId}`);
      return this.findByCustomer(input.customerId);
    } catch (error) {
      this.logger.warn(`Virtual account provisioning pending for customer ${input.customerId}`);
      return this.findByCustomer(input.customerId);
    }
  }

  async findByCustomer(customerId: string) {
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT "id", "customerId", "branchId", "accountNumber", "accountName",
             "bankName", "bankCode", "provider", "providerReference",
             "status", "isPrimary", "createdAt", "updatedAt"
      FROM "CustomerVirtualAccount"
      WHERE "customerId" = ${customerId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  }
}
