import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HumanResourcesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async dashboard() {
    const [
      totalStaff,
      activeStaff,
      inactiveStaff,
      departments,
      branches,
    ] = await Promise.all([
      this.prisma.staff.count(),

      this.prisma.staff.count({
        where: {
          employmentStatus: 'ACTIVE',
        },
      }),

      this.prisma.staff.count({
        where: {
          employmentStatus: {
            not: 'ACTIVE',
          },
        },
      }),

      this.prisma.department.count(),

      this.prisma.branch.count(),
    ]);

    return {
      totalStaff,
      activeStaff,
      inactiveStaff,
      departments,
      branches,
    };
  }

  async employees() {
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

  async employee(id: string) {
    const staff = await this.prisma.staff.findUnique({
      where: {
        id,
      },
      include: {
        department: true,
        branch: true,
      },
    });

    if (!staff) {
      throw new NotFoundException(
        'Employee not found',
      );
    }

    return staff;
  }

  async departments() {
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

  async branches() {
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

  async activeEmployees() {
    return this.prisma.staff.findMany({
      where: {
        employmentStatus: 'ACTIVE',
      },
      orderBy: {
        firstName: 'asc',
      },
      include: {
        department: true,
        branch: true,
      },
    });
  }
}
