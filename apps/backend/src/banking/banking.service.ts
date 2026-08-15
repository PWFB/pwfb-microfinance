import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BankingService {
  constructor(private readonly prisma: PrismaService) {}

  async listInstitutions() {
    return this.prisma.bankInstitution.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async searchInstitutions(search?: string) {
    return this.prisma.bankInstitution.findMany({
      where: {
        active: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async getCustomerAccounts(customerId: string) {
    return this.prisma.customerBankAccount.findMany({
      where: { customerId },
      include: {
        institution: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addCustomerAccount(data: {
    customerId: string;
    institutionId: string;
    accountNumber: string;
    accountName?: string;
    isPrimary?: boolean;
  }) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const institution = await this.prisma.bankInstitution.findUnique({
      where: { id: data.institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Bank or payment institution not found');
    }

    if (data.isPrimary) {
      await this.prisma.customerBankAccount.updateMany({
        where: { customerId: data.customerId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.customerBankAccount.create({
      data: {
        customerId: data.customerId,
        institutionId: data.institutionId,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        isPrimary: data.isPrimary ?? false,
      },
      include: {
        institution: true,
      },
    });
  }

  async getBranchVirtualAccounts(branchId: string) {
    return this.prisma.branchVirtualAccount.findMany({
      where: { branchId },
      include: {
        institution: true,
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateBranchVirtualAccount(
    branchId: string,
    institutionId: string,
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const institution = await this.prisma.bankInstitution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Bank or payment institution not found');
    }

    const existing = await this.prisma.branchVirtualAccount.findUnique({
      where: {
        branchId_institutionId: {
          branchId,
          institutionId,
        },
      },
      include: {
        institution: true,
        branch: true,
      },
    });

    if (existing) {
      return existing;
    }

    let accountNumber = '';

    do {
      accountNumber =
        `9${Date.now().toString().slice(-8)}` +
        Math.floor(Math.random() * 10);

    } while (
      await this.prisma.branchVirtualAccount.findUnique({
        where: { accountNumber },
      })
    );

    return this.prisma.branchVirtualAccount.create({
      data: {
        branchId,
        institutionId,
        accountNumber,
        accountName: `PWFB - ${branch.name}`,
        isGenerated: true,
        generatedAt: new Date(),
      },
      include: {
        institution: true,
        branch: true,
      },
    });
  }
}
