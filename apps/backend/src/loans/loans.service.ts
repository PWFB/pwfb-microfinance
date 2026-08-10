import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createLoanDto: CreateLoanDto,
  ) {
    const customer =
      await this.prisma.customer.findUnique({
        where: {
          id: createLoanDto.customerId,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    return this.prisma.loan.create({
      data: {
        customerId: createLoanDto.customerId,
        amount: createLoanDto.amount,
        interestRate:
          createLoanDto.interestRate,
        status:
          createLoanDto.status ?? 'PENDING',
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  }

  findAll() {
    return this.prisma.loan.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  }

  async findOne(id: string) {
    const loan =
      await this.prisma.loan.findUnique({
        where: { id },
        include: {
          customer: true,
          repayments: true,
        },
      });

    if (!loan) {
      throw new NotFoundException(
        'Loan not found',
      );
    }

    return loan;
  }

  async update(
    id: string,
    updateLoanDto: UpdateLoanDto,
  ) {
    await this.findOne(id);

    if (updateLoanDto.customerId) {
      const customer =
        await this.prisma.customer.findUnique({
          where: {
            id: updateLoanDto.customerId,
          },
        });

      if (!customer) {
        throw new NotFoundException(
          'Customer not found',
        );
      }
    }

    return this.prisma.loan.update({
      where: { id },
      data: {
        customerId:
          updateLoanDto.customerId,
        amount:
          updateLoanDto.amount,
        interestRate:
          updateLoanDto.interestRate,
        status:
          updateLoanDto.status,
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.loan.delete({
      where: { id },
    });
  }
}
