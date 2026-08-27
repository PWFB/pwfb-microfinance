import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  private virtualAccountNumber(id: string) {
    const digits = id.replace(/\D/g, '').slice(-8).padStart(8, '0');
    return `PWFB${digits}`;
  }

  async create(dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({ data: dto as any });
    const existing = await this.prisma.branchVirtualAccount.findFirst({ where: { branchId: branch.id } });
    if (!existing) {
      await this.prisma.branchVirtualAccount.create({
        data: {
          branchId: branch.id,
          accountNumber: this.virtualAccountNumber(branch.id),
          accountName: branch.name,
          provider: process.env.BANK_TRANSFER_PROVIDER || 'NIBSS',
          status: 'ACTIVE',
        },
      });
    }
    return this.findOne(branch.id);
  }

  async findAll() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branchAccounts: true },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        branchAccounts: true,
        areas: true,
        customers: { take: 50, orderBy: { createdAt: 'desc' } },
        staff: { take: 50, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto as any, include: { branchAccounts: true } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.delete({ where: { id } });
    return { message: 'Branch deleted successfully' };
  }

  async provisionVirtualAccounts() {
    const branches = await this.prisma.branch.findMany({ include: { branchAccounts: true } });
    const results: any[] = [];
    for (const branch of branches) {
      let account = branch.branchAccounts[0];
      if (!account) {
        account = await this.prisma.branchVirtualAccount.create({
          data: {
            branchId: branch.id,
            accountNumber: this.virtualAccountNumber(branch.id),
            accountName: branch.name,
            provider: process.env.BANK_TRANSFER_PROVIDER || 'NIBSS',
            status: 'ACTIVE',
          },
        });
      }
      results.push({ branchId: branch.id, branchName: branch.name, virtualAccount: account });
    }
    return { totalBranches: branches.length, provisioned: results };
  }
}
