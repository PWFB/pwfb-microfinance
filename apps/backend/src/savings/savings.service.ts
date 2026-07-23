import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(createSavingsDto: CreateSavingsDto) {
    return this.prisma.savings.create({
      data: createSavingsDto,
    });
  }

  async findAll() {
    return this.prisma.savings.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.savings.findUnique({
      where: { id },
    });
  }

  async update(
    id: string,
    updateSavingsDto: UpdateSavingsDto,
  ) {
    return this.prisma.savings.update({
      where: { id },
      data: updateSavingsDto,
    });
  }

  async remove(id: string) {
    return this.prisma.savings.delete({
      where: { id },
    });
  }
}
