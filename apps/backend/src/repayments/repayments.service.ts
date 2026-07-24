import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

@Injectable()
export class RepaymentsService {
  constructor(private prisma: PrismaService) {}

  create(createRepaymentDto: CreateRepaymentDto) {
    return this.prisma.repayment.create({
      data: createRepaymentDto,
    });
  }

  findAll() {
    return this.prisma.repayment.findMany({
      include: {
        loan: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.repayment.findUnique({
      where: { id },
      include: {
        loan: true,
      },
    });
  }

  update(id: string, updateRepaymentDto: UpdateRepaymentDto) {
    return this.prisma.repayment.update({
      where: { id },
      data: updateRepaymentDto,
    });
  }

  remove(id: string) {
    return this.prisma.repayment.delete({
      where: { id },
    });
  }
}
