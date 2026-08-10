import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

@Injectable()
export class RepaymentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createRepaymentDto: CreateRepaymentDto,
  ) {
    const loan =
      await this.prisma.loan.findUnique({
        where: {
          id: createRepaymentDto.loanId,
        },
      });

    if (!loan) {
      throw new NotFoundException(
        'Loan not found',
      );
    }

    return this.prisma.repayment.create({
      data: {
        loanId: createRepaymentDto.loanId,
        amount: createRepaymentDto.amount,
        paymentDate:
          createRepaymentDto.paymentDate
            ? new Date(
                createRepaymentDto.paymentDate,
              )
            : undefined,
        method: createRepaymentDto.method,
        notes: createRepaymentDto.notes,
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  findAll() {
    return this.prisma.repayment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const repayment =
      await this.prisma.repayment.findUnique({
        where: { id },
        include: {
          loan: {
            include: {
              customer: true,
            },
          },
        },
      });

    if (!repayment) {
      throw new NotFoundException(
        'Repayment not found',
      );
    }

    return repayment;
  }

  async update(
    id: string,
    updateRepaymentDto: UpdateRepaymentDto,
  ) {
    await this.findOne(id);

    if (updateRepaymentDto.loanId) {
      const loan =
        await this.prisma.loan.findUnique({
          where: {
            id: updateRepaymentDto.loanId,
          },
        });

      if (!loan) {
        throw new NotFoundException(
          'Loan not found',
        );
      }
    }

    return this.prisma.repayment.update({
      where: { id },
      data: {
        loanId: updateRepaymentDto.loanId,
        amount: updateRepaymentDto.amount,
        paymentDate:
          updateRepaymentDto.paymentDate
            ? new Date(
                updateRepaymentDto.paymentDate,
              )
            : undefined,
        method: updateRepaymentDto.method,
        notes: updateRepaymentDto.notes,
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.repayment.delete({
      where: { id },
    });
  }
}
