import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createSavingsDto: CreateSavingsDto,
  ) {
    const customer =
      await this.prisma.customer.findUnique({
        where: {
          id: createSavingsDto.customerId,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const savings = await tx.savings.create({
        data: {
          customerId: createSavingsDto.customerId,
          amount: createSavingsDto.amount,
          accountType:
            createSavingsDto.accountType,
        },
        include: {
          customer: true,
        },
      });

      // Every non-negative opening balance must have an auditable
      // ledger entry. This prevents BALMZ from correctly reporting
      // a newly-created funded savings account with no transaction
      // history. The transaction and savings record are atomic.
      if (createSavingsDto.amount > 0) {
        await tx.transaction.create({
          data: {
            customerId: createSavingsDto.customerId,
            type: 'Deposit',
            amount: createSavingsDto.amount,
            description: `Savings account opening deposit — ${createSavingsDto.accountType}`,
          },
        });
      }

      return savings;
    });
  }

  async findAll() {
    return this.prisma.savings.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
      },
    });
  }

  async findOne(id: string) {
    const savings =
      await this.prisma.savings.findUnique({
        where: { id },
        include: {
          customer: true,
        },
      });

    if (!savings) {
      throw new NotFoundException(
        'Savings account not found',
      );
    }

    return savings;
  }

  async update(
    id: string,
    updateSavingsDto: UpdateSavingsDto,
  ) {
    await this.findOne(id);

    if (updateSavingsDto.customerId) {
      const customer =
        await this.prisma.customer.findUnique({
          where: {
            id: updateSavingsDto.customerId,
          },
        });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found',
        );
      }
    }

    return this.prisma.savings.update({
      where: { id },
      data: {
        customerId:
          updateSavingsDto.customerId,
        amount:
          updateSavingsDto.amount,
        accountType:
          updateSavingsDto.accountType,
      },
      include: {
        customer: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.savings.delete({
      where: { id },
    });
  }
}
