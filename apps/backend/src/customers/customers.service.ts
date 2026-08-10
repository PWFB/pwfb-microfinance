import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    createCustomerDto: CreateCustomerDto,
  ) {
    return this.prisma.customer.create({
      data: {
        firstName: createCustomerDto.firstName,
        lastName: createCustomerDto.lastName,
        email: createCustomerDto.email,
        phone: createCustomerDto.phone,
        address: createCustomerDto.address,
        dateOfBirth:
          createCustomerDto.dateOfBirth
            ? new Date(
                createCustomerDto.dateOfBirth,
              )
            : undefined,
      },
    });
  }

  async findAll() {
    return this.prisma.customer.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        savings: true,
        loans: true,
        transactions: true,
      },
    });
  }

  async findOne(id: string) {
    const customer =
      await this.prisma.customer.findUnique({
        where: { id },
        include: {
          savings: true,
          loans: true,
          transactions: true,
        },
      });

    if (!customer) {
      throw new NotFoundException(
        'Customer not found',
      );
    }

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ) {
    await this.findOne(id);

    return this.prisma.customer.update({
      where: { id },
      data: {
        firstName: updateCustomerDto.firstName,
        lastName: updateCustomerDto.lastName,
        email: updateCustomerDto.email,
        phone: updateCustomerDto.phone,
        address: updateCustomerDto.address,
        dateOfBirth:
          updateCustomerDto.dateOfBirth
            ? new Date(
                updateCustomerDto.dateOfBirth,
              )
            : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.customer.delete({
      where: { id },
    });
  }
}
