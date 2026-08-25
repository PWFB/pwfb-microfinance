import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from '../access/staff-scope.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

@Injectable()
export class SavingsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: StaffScopeService) {}

  async create(dto: CreateSavingsDto, authUser: any) {
    await this.scope.assertCustomerAccess(authUser, dto.customerId);
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.savings.create({ data: { customerId: dto.customerId, amount: dto.amount, accountType: dto.accountType }, include: { customer: true } });
  }

  async findAll(authUser: any) {
    const where = await this.scope.customerWhere(authUser);
    return this.prisma.savings.findMany({ where: { customer: where } as any, orderBy: { createdAt: 'desc' }, include: { customer: true } });
  }

  async findOne(id: string, authUser: any) {
    const where = await this.scope.customerWhere(authUser);
    const savings = await this.prisma.savings.findFirst({ where: { id, customer: where } as any, include: { customer: true } });
    if (!savings) throw new NotFoundException('Savings account not found or not accessible');
    return savings;
  }

  async update(id: string, dto: UpdateSavingsDto, authUser: any) {
    await this.findOne(id, authUser);
    if (dto.customerId) await this.scope.assertCustomerAccess(authUser, dto.customerId);
    return this.prisma.savings.update({ where: { id }, data: { customerId: dto.customerId, amount: dto.amount, accountType: dto.accountType }, include: { customer: true } });
  }

  async remove(id: string, authUser: any) { await this.findOne(id, authUser); return this.prisma.savings.delete({ where: { id } }); }
}
