import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.region.findMany({
      orderBy: { name: 'asc' },
      include: {
        divisions: { orderBy: { name: 'asc' }, include: { areas: true, branches: true, staff: true } },
        areas: { orderBy: { name: 'asc' }, include: { branches: true, staff: true } },
        branches: { orderBy: { name: 'asc' }, include: { staff: true } },
        staff: true,
      },
    });
  }

  createRegion(body: { name: string; code?: string }) {
    return this.prisma.region.create({ data: { name: body.name, code: body.code } });
  }

  createDivision(body: { name: string; regionId: string }) {
    return this.prisma.division.create({ data: { name: body.name, regionId: body.regionId } });
  }

  createArea(body: { name: string; regionId: string; divisionId?: string }) {
    return this.prisma.area.create({ data: { name: body.name, regionId: body.regionId, divisionId: body.divisionId } });
  }

  async regionStaff(regionId: string) {
    const region = await this.prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
    if (!region) throw new NotFoundException('Region not found');
    return this.prisma.staff.findMany({
      where: { regionId },
      orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
      include: { branch: true, department: true, assignments: { orderBy: { startsAt: 'desc' } } },
    });
  }
}
