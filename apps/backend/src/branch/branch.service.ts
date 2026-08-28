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

  /**
   * Branch virtual accounts are represented by the Prisma
   * BankInstitution relation. The old implementation attempted to write a
   * `provider` field that does not exist on BranchVirtualAccount.
   */
  private async virtualAccountInstitution() {
    return this.prisma.bankInstitution.upsert({
      where: { name: 'PWFB Virtual Accounts' },
      update: { active: true },
      create: {
        name: 'PWFB Virtual Accounts',
        shortName: 'PWFB VA',
        code: 'PWFBVA',
        type: 'PAYMENT_PROVIDER',
        active: true,
      },
    });
  }

  async create(dto: CreateBranchDto) {
    const branch = await this.prisma.branch.create({ data: dto as any });
    const existing = await this.prisma.branchVirtualAccount.findFirst({ where: { branchId: branch.id } });

    if (!existing) {
      const institution = await this.virtualAccountInstitution();
      await this.prisma.branchVirtualAccount.create({
        data: {
          branchId: branch.id,
          institutionId: institution.id,
          accountNumber: this.virtualAccountNumber(branch.id),
          accountName: branch.name,
          status: 'ACTIVE',
          isGenerated: true,
          generatedAt: new Date(),
        },
      });
    }

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
    return this.prisma.branch.update({
      where: { id },
      data: dto as any,
      include: { branchAccounts: { include: { institution: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.branch.delete({ where: { id } });
    return { message: 'Branch deleted successfully' };
  }

  async provisionVirtualAccounts() {
    const branches = await this.prisma.branch.findMany({ include: { branchAccounts: { include: { institution: true } } } });
    const institution = await this.virtualAccountInstitution();
    const results: any[] = [];

    for (const branch of branches) {
      let account = branch.branchAccounts[0];
      if (!account) {
        account = await this.prisma.branchVirtualAccount.create({
          data: {
            branchId: branch.id,
            institutionId: institution.id,
            accountNumber: this.virtualAccountNumber(branch.id),
            accountName: branch.name,
            status: 'ACTIVE',
            isGenerated: true,
            generatedAt: new Date(),
          },
          include: { institution: true },
        });
      }
      results.push({ branchId: branch.id, branchName: branch.name, virtualAccount: account });
    }

    return { totalBranches: branches.length, provisioned: results };
  }
}
