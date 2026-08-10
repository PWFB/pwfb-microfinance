import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createTransactionDto: CreateTransactionDto,
  ) {
    const customer =
      await this.prisma.customer.findUnique({
        where: {
          id: createTransactionDto.customerId,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    return this.prisma.transaction.create({
      data: {
        customerId:
          createTransactionDto.customerId,
        type: createTransactionDto.type,
        amount: createTransactionDto.amount,
        description:
          createTransactionDto.description,
      },
      include: {
        customer: true,
      },
    });
  }

  findAll() {
    return this.prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
      },
    });
  }

  async findOne(id: string) {
    const transaction =
      await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          customer: true,
        },
      });

    if (!transaction) {
      throw new NotFoundException(
        'Transaction not found',
      );
    }

    return transaction;
  }

  async update(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    await this.findOne(id);

    if (updateTransactionDto.customerId) {
      const customer =
        await this.prisma.customer.findUnique({
          where: {
            id: updateTransactionDto.customerId,
          },
        });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found',
        );
      }
    }

    return this.prisma.transaction.update({
      where: { id },
      data: {
        customerId:
          updateTransactionDto.customerId,
        type: updateTransactionDto.type,
        amount: updateTransactionDto.amount,
        description:
          updateTransactionDto.description,
      },
      include: {
        customer: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
