import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  create(data: any) {
    return this.prisma.transaction.create({
      data,
    });
  }

  findAll() {
    return this.prisma.transaction.findMany({
      include: {
        customer: true,
      },
    });
  }

  findOne(id: string) {
    return this.prisma.transaction.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });
  }

  update(id: string, data: any) {
    return this.prisma.transaction.update({
      where: { id },
      data,
    });
  }

  remove(id: string) {
    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
