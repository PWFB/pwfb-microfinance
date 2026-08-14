import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashbookService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    periodId: string;
    branchId: string;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reference?: string;
    description?: string;
    entryDate?: string;
  }) {
    const period = await this.prisma.financialPeriod.findUnique({
      where: { id: data.periodId },
    });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot add cashbook entries to a closed period',
      );
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: data.branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        'Amount must be greater than zero',
      );
    }

    return this.prisma.cashbookEntry.create({
      data: {
        periodId: data.periodId,
        branchId: data.branchId,
        type: data.type,
        amount,
        reference: data.reference,
        description: data.description,
        entryDate: data.entryDate
          ? new Date(data.entryDate)
          : new Date(),
      },
      include: {
        period: true,
        branch: true,
      },
    });
  }

  async findAll(periodId?: string, branchId?: string) {
    return this.prisma.cashbookEntry.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(branchId ? { branchId } : {}),
      },
      orderBy: {
        entryDate: 'desc',
      },
      include: {
        period: true,
        branch: true,
      },
    });
  }

  async findOne(id: string) {
    const entry = await this.prisma.cashbookEntry.findUnique({
      where: { id },
      include: {
        period: true,
        branch: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Cashbook entry not found');
    }

    return entry;
  }

  async summary(periodId?: string, branchId?: string) {
    const entries =
      await this.prisma.cashbookEntry.findMany({
        where: {
          ...(periodId ? { periodId } : {}),
          ...(branchId ? { branchId } : {}),
        },
      });

    const result = entries.reduce(
      (summary, entry) => {
        if (entry.type === 'CASH_IN') {
          summary.cashIn += entry.amount;
        } else {
          summary.cashOut += entry.amount;
        }

        return summary;
      },
      {
        cashIn: 0,
        cashOut: 0,
        balance: 0,
        entryCount: 0,
      },
    );

    result.entryCount = entries.length;
    result.balance = result.cashIn - result.cashOut;

    return result;
  }

  async remove(id: string) {
    const entry = await this.findOne(id);

    if (entry.period.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot delete an entry from a closed period',
      );
    }

    await this.prisma.cashbookEntry.delete({
      where: { id },
    });

    return {
      message: 'Cashbook entry deleted successfully',
    };
  }
}
