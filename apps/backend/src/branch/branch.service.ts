import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureBranchVirtualAccount(branchId: string, branchName: string) {
    const existing = await this.prisma.branchVirtualAccount.findFirst({
      where: { branchId, status: 'ACTIVE' },
      include: { institution: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const institution = await this.prisma.bankInstitution.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!institution) return null;

    let accountNumber = '';
    do {
      accountNumber = `9${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10)}`;
    } while (await this.prisma.branchVirtualAccount.findUnique({ where: { accountNumber } }));

    return this.prisma.branchVirtualAccount.create({
      data: {
        branchId,
        institutionId: institution.id,
        accountNumber,
        accountName: `PWFB - ${branchName}`,
        status: 'ACTIVE',
        isGenerated: true,
        generatedAt: new Date(),
      },
      include: { institution: true },
    });
  }

  async create(dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({ data: dto as any });
    await this.ensureBranchVirtualAccount(branch.id, branch.name).catch(() => null);
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
