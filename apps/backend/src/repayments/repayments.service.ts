import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private amount(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException('Repayment amount must be greater than zero');
    }
    return Math.round(n * 100) / 100;
  }

  async create(createRepaymentDto: CreateRepaymentDto) {
    const amount = this.amount(createRepaymentDto.amount);
    const loan = await this.prisma.loan.findUnique({
      where: { id: createRepaymentDto.loanId },
    });

    if (!loan) throw new NotFoundException('Loan not found');

    return this.prisma.$transaction(async (tx) => {
      const repayment = await tx.repayment.create({
        data: {
          loanId: createRepaymentDto.loanId,
          amount,
          paymentDate: createRepaymentDto.paymentDate
            ? new Date(createRepaymentDto.paymentDate)
            : undefined,
          method: createRepaymentDto.method,
          notes: createRepaymentDto.notes,
        },
        include: {
          loan: { include: { customer: true } },
        },
      });

      await tx.transaction.create({
        data: {
          customerId: loan.customerId,
          type: 'LOAN_REPAYMENT',
          amount,
          description: `Loan repayment — ${loan.id}${createRepaymentDto.method ? ` — ${createRepaymentDto.method}` : ''}`,
        },
      });

      return repayment;
    });
  }

  findAll() {
    return this.prisma.repayment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { loan: { include: { customer: true } } },
    });
  }

  async findOne(id: string) {
    const repayment = await this.prisma.repayment.findUnique({
      where: { id },
      include: { loan: { include: { customer: true } } },
    });

    if (!repayment) throw new NotFoundException('Repayment not found');
    return repayment;
  }

  async update(id: string, updateRepaymentDto: UpdateRepaymentDto) {
    const existing = await this.findOne(id);

    if (updateRepaymentDto.loanId && updateRepaymentDto.loanId !== existing.loanId) {
      throw new BadRequestException(
        'A repayment cannot be moved to another loan. Create a reversal and a new repayment instead.',
      );
    }

    const newAmount = updateRepaymentDto.amount === undefined
      ? Number(existing.amount)
      : this.amount(updateRepaymentDto.amount);
    const oldAmount = Number(existing.amount);
    const delta = Math.round((newAmount - oldAmount) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      const repayment = await tx.repayment.update({
        where: { id },
        data: {
          amount: newAmount,
          paymentDate: updateRepaymentDto.paymentDate
            ? new Date(updateRepaymentDto.paymentDate)
            : undefined,
          method: updateRepaymentDto.method,
          notes: updateRepaymentDto.notes,
        },
        include: { loan: { include: { customer: true } } },
      });

      if (delta !== 0) {
        await tx.transaction.create({
          data: {
            customerId: existing.loan.customerId,
            type: delta > 0 ? 'LOAN_REPAYMENT_ADJUSTMENT' : 'LOAN_REPAYMENT_REVERSAL',
            amount: Math.abs(delta),
            description: `Repayment ${id} amount correction from ${oldAmount} to ${newAmount}`,
          },
        });
      }

      return repayment;
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.repayment.delete({ where: { id } });

      await tx.transaction.create({
        data: {
          customerId: existing.loan.customerId,
          type: 'LOAN_REPAYMENT_REVERSAL',
          amount: Number(existing.amount),
          description: `Reversal of deleted loan repayment ${id}`,
        },
      });

      return deleted;
    });
  }
}
