import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
      include: { institution: true },
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

    if (!institution.active) {
      throw new BadRequestException('Bank or payment institution is inactive');
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
      include: { institution: true },
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

  async getCustomerWallet(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.customerWallet.upsert({
      where: { customerId },
      create: { customerId },
      update: {},
    });
  }

  async getCustomerTransactions(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.walletTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Amount must be greater than zero',
      );
    }

    return Math.round(amount * 100) / 100;
  }

  private reference(prefix: string) {
    return `${prefix}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)
      .toUpperCase()}`;
  }

  async deposit(
    customerId: string,
    data: {
      amount: number;
      description?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    const amount = this.validateAmount(Number(data.amount));

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      const wallet = await tx.customerWallet.upsert({
        where: { customerId },
        create: { customerId, balance: 0 },
        update: {},
      });

      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Customer wallet is not active');
      }

      const newBalance =
        Math.round((wallet.balance + amount) * 100) / 100;

      const updatedWallet = await tx.customerWallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance: wallet.balance,
          newBalance,
          reference: this.reference('DEP'),
          description: data.description ?? 'Wallet deposit',
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });

      return {
        wallet: updatedWallet,
        transaction,
      };
    });
  }

  async withdraw(
    customerId: string,
    data: {
      amount: number;
      description?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    const amount = this.validateAmount(Number(data.amount));

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.findUnique({
        where: { customerId },
      });

      if (!wallet) {
        throw new NotFoundException('Customer wallet not found');
      }

      if (wallet.status !== 'ACTIVE') {
        throw new BadRequestException('Customer wallet is not active');
      }

      if (wallet.balance < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const newBalance =
        Math.round((wallet.balance - amount) * 100) / 100;

      const updatedWallet = await tx.customerWallet.updateMany({
        where: {
          id: wallet.id,
          balance: { gte: amount },
          status: 'ACTIVE',
        },
        data: { balance: newBalance },
      });

      if (updatedWallet.count !== 1) {
        throw new BadRequestException(
          'Withdrawal could not be completed because the balance changed',
        );
      }

      const transaction = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'WITHDRAWAL',
          amount,
          previousBalance: wallet.balance,
          newBalance,
          reference: this.reference('WDR'),
          description: data.description ?? 'Wallet withdrawal',
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });

      return {
        wallet: {
          ...wallet,
          balance: newBalance,
        },
        transaction,
      };
    });
  }

  async transfer(
    customerId: string,
    data: {
      recipientCustomerId: string;
      amount: number;
      description?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    const amount = this.validateAmount(Number(data.amount));

    if (!data.recipientCustomerId) {
      throw new BadRequestException(
        'Recipient customer is required',
      );
    }

    if (customerId === data.recipientCustomerId) {
      throw new BadRequestException(
        'You cannot transfer to the same customer',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const [sender, recipient] = await Promise.all([
        tx.customer.findUnique({
          where: { id: customerId },
        }),
        tx.customer.findUnique({
          where: { id: data.recipientCustomerId },
        }),
      ]);

      if (!sender) {
        throw new NotFoundException('Sender customer not found');
      }

      if (!recipient) {
        throw new NotFoundException(
          'Recipient customer not found',
        );
      }

      const senderWallet = await tx.customerWallet.findUnique({
        where: { customerId },
      });

      if (!senderWallet) {
        throw new NotFoundException('Sender wallet not found');
      }

      if (senderWallet.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Sender wallet is not active',
        );
      }

      if (senderWallet.balance < amount) {
        throw new BadRequestException('Insufficient wallet balance');
      }

      const recipientWallet = await tx.customerWallet.upsert({
        where: {
          customerId: data.recipientCustomerId,
        },
        create: {
          customerId: data.recipientCustomerId,
          balance: 0,
        },
        update: {},
      });

      if (recipientWallet.status !== 'ACTIVE') {
        throw new BadRequestException(
          'Recipient wallet is not active',
        );
      }

      const senderBalance =
        Math.round((senderWallet.balance - amount) * 100) / 100;

      const recipientBalance =
        Math.round((recipientWallet.balance + amount) * 100) / 100;

      const senderUpdate = await tx.customerWallet.updateMany({
        where: {
          id: senderWallet.id,
          balance: { gte: amount },
          status: 'ACTIVE',
        },
        data: { balance: senderBalance },
      });

      if (senderUpdate.count !== 1) {
        throw new BadRequestException(
          'Transfer could not be completed because the sender balance changed',
        );
      }

      const updatedRecipient =
        await tx.customerWallet.update({
          where: { id: recipientWallet.id },
          data: { balance: recipientBalance },
        });

      const transferReference = this.reference('TRF');

      const outgoing = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'TRANSFER_OUT',
          amount,
          previousBalance: senderWallet.balance,
          newBalance: senderBalance,
          reference: `${transferReference}-OUT`,
          description:
            data.description ??
            `Transfer to ${recipient.firstName} ${recipient.lastName}`,
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });

      const incoming = await tx.walletTransaction.create({
        data: {
          customerId: data.recipientCustomerId,
          type: 'TRANSFER_IN',
          amount,
          previousBalance: recipientWallet.balance,
          newBalance: recipientBalance,
          reference: `${transferReference}-IN`,
          description:
            data.description ??
            `Transfer from ${sender.firstName} ${sender.lastName}`,
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });

      return {
        senderWallet: {
          ...senderWallet,
          balance: senderBalance,
        },
        recipientWallet: updatedRecipient,
        outgoing,
        incoming,
      };
    });
  }
}
