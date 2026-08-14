import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    name: string;
    startDate: string;
    endDate: string;
  }) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      throw new BadRequestException('Invalid period dates');
    }

    if (endDate <= startDate) {
      throw new BadRequestException(
        'End date must be after start date',
      );
    }

    const existingOpen = await this.prisma.financialPeriod.findFirst({
      where: {
        status: 'OPEN',
      },
    });

    if (existingOpen) {
      throw new BadRequestException(
        `Period "${existingOpen.name}" is already open`,
      );
    }

    return this.prisma.financialPeriod.create({
      data: {
        name: data.name,
        startDate,
        endDate,
        status: 'OPEN',
      },
    });
  }

  async findAll() {
    return this.prisma.financialPeriod.findMany({
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async current() {
    const period = await this.prisma.financialPeriod.findFirst({
      where: {
        status: 'OPEN',
      },
      orderBy: {
        startDate: 'desc',
      },
    });

    if (!period) {
      throw new NotFoundException(
        'No open financial period found',
      );
    }

    return period;
  }

  async findOne(id: string) {
    const period =
      await this.prisma.financialPeriod.findUnique({
        where: { id },
      });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    return period;
  }

  async close(id: string) {
    const period =
      await this.prisma.financialPeriod.findUnique({
        where: { id },
      });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestException(
        'Financial period is already closed',
      );
    }

    return this.prisma.financialPeriod.update({
      where: { id },
      data: {
        status: 'CLOSED',
      },
    });
  }
}
