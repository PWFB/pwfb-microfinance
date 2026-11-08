import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService) {}

  private amount(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new BadRequestException('Savings amount cannot be negative');
    }
    return Math.round(n * 100) / 100;
  }

  async create(createSavingsDto: CreateSavingsDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: createSavingsDto.customerId },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    const openingAmount = this.amount(createSavingsDto.amount);

    return this.prisma.$transaction(async (tx) => {
      const savings = await tx.savings.create({
        data: {
          customerId: createSavingsDto.customerId,
          amount: openingAmount,
          accountType: createSavingsDto.accountType,
        },
        include: { customer: true },
      });

      if (openingAmount > 0) {
        await tx.transaction.create({
          data: {
            customerId: createSavingsDto.customerId,
            type: 'Deposit',
            amount: openingAmount,
            description: `Savings account opening deposit — ${createSavingsDto.accountType}`,
          },
        });
      }

      return savings;
    });
  }

  async deposit(id: string, amount: number, description?: string) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Deposit amount must be greater than zero');
    }

    const savings = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.savings.update({
        where: { id: savings.id },
        data: { amount: { increment: value } },
        include: { customer: true },
      });

      await tx.transaction.create({
        data: {
          customerId: savings.customerId,
          type: 'Deposit',
          amount: value,
          description: description || `Savings deposit — ${savings.id}`,
        },
      });

      return updated;
    });
  }

  async withdraw(id: string, amount: number, description?: string) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException('Withdrawal amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const savings = await tx.savings.findUnique({ where: { id } });
      if (!savings) throw new NotFoundException('Savings account not found');
      const balance = Number(savings.amount || 0);
      if (value > balance) {
        throw new BadRequestException(`Insufficient savings balance. Available balance is ${balance}`);
      }

      const updated = await tx.savings.update({
        where: { id: savings.id },
        data: { amount: { decrement: value } },
        include: { customer: true },
      });

      await tx.transaction.create({
        data: {
          customerId: savings.customerId,
          type: 'Withdrawal',
          amount: value,
          description: description || `Savings withdrawal — ${savings.id}`,
        },
      });

      return updated;
    });
  }

  async findAll() {
    return this.prisma.savings.findMany({
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });
  }

  async findOne(id: string) {
    const savings = await this.prisma.savings.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!savings) throw new NotFoundException('Savings account not found');
    return savings;
  }

  async update(id: string, updateSavingsDto: UpdateSavingsDto) {
    const existing = await this.findOne(id);

    if (updateSavingsDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: updateSavingsDto.customerId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    // Amount changes are financial movements. Never silently change the balance:
    // record the difference in the same database transaction as the balance update.
    if (updateSavingsDto.amount !== undefined) {
      const newAmount = this.amount(updateSavingsDto.amount);
      const oldAmount = this.amount(existing.amount);
      const delta = Math.round((newAmount - oldAmount) * 100) / 100;

      if (delta !== 0) {
        return this.prisma.$transaction(async (tx) => {
          const updated = await tx.savings.update({
            where: { id },
            data: {
              customerId: updateSavingsDto.customerId ?? undefined,
              amount: newAmount,
              accountType: updateSavingsDto.accountType ?? undefined,
            },
            include: { customer: true },
          });

          await tx.transaction.create({
            data: {
              customerId: updated.customerId,
              type: delta > 0 ? 'Deposit' : 'Withdrawal',
              amount: Math.abs(delta),
              description: `Savings balance correction — ${id}`,
            },
          });

          return updated;
        });
      }
    }

    return this.prisma.savings.update({
      where: { id },
      data: {
        customerId: updateSavingsDto.customerId,
        amount: updateSavingsDto.amount === undefined ? undefined : this.amount(updateSavingsDto.amount),
        accountType: updateSavingsDto.accountType,
      },
      include: { customer: true },
    });
  }

  async remove(id: string) {
    const savings = await this.findOne(id);
    if (Number(savings.amount || 0) !== 0) {
      throw new BadRequestException('Savings account with a balance cannot be deleted. Withdraw or transfer the balance first.');
    }

    return this.prisma.savings.delete({ where: { id } });
  }
}
