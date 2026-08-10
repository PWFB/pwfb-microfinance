import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async overview() {
    const [
      users,
      staff,
      departments,
      branches,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.staff.count(),
      this.prisma.department.count(),
      this.prisma.branch.count(),
    ]);

    return {
      users,
      staff,
      departments,
      branches,
    };
  }

  async getDepartments() {
    return this.prisma.department.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  }

  async getBranches() {
    return this.prisma.branch.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  }

  async getStaff() {
    return this.prisma.staff.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        department: true,
        branch: true,
      },
    });
  }

  async getUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(({ password, ...user }) => user);
  }

  async getDepartment(id: string) {
    const department =
      await this.prisma.department.findUnique({
        where: { id },
        include: {
          staff: true,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found',
      );
    }

    return department;
  }

  async getBranch(id: string) {
    const branch =
      await this.prisma.branch.findUnique({
        where: { id },
        include: {
          staff: true,
        },
      });

    if (!branch) {
      throw new NotFoundException(
        'Branch not found',
      );
    }

    return branch;
  }
}
