import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({ data: dto as any });
    return this.findOne(branch.id);
  }

  async findAll() {
    return this.prisma.branch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { branchAccounts: { include: { institution: true } } },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        branchAccounts: { include: { institution: true } },
        area: true,
        customers: { take: 50, orderBy: { createdAt: 'desc' } },
        staff: { take: 50, orderBy: { createdAt: 'desc' } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    return this.prisma.branch.update({ where: { id }, data: dto as any, include: { branchAccounts: { include: { institution: true } } } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.delete({ where: { id } });
    return { message: 'Branch deleted successfully' };
  }

  async provisionVirtualAccounts() {
    const branches = await this.prisma.branch.findMany({ include: { branchAccounts: { include: { institution: true } } } });
    return {
      totalBranches: branches.length,
      provisioned: branches.map((branch) => ({
        branchId: branch.id,
        branchName: branch.name,
        virtualAccount: branch.branchAccounts.find((a) => a.status === 'ACTIVE' && a.accountNumber.match(/^\d{10}$/)) || null,
        requiresPaystackProvisioning: !branch.branchAccounts.some((a) => a.status === 'ACTIVE' && a.accountNumber.match(/^\d{10}$/)),
      })),
    };
  }
}
