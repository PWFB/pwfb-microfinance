import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly fullRoles: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

  private async getScope(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { staff: { include: { assignments: { where: { active: true }, orderBy: { startsAt: 'desc' } } } } },
    });
    if (!user) throw new NotFoundException('User not found');
    if (this.fullRoles.includes(user.role)) return { role: user.role, full: true };
    const assignment = user.staff?.assignments[0];
    if (!assignment) throw new ForbiddenException('No active organizational assignment');
    return { role: assignment.role, assignment, full: false };
  }

  async listForUser(userId: string) {
    const scope = await this.getScope(userId);
    const where = scope.full
      ? {}
      : scope.assignment?.role === Role.REGIONAL_MANAGER || scope.assignment?.role === Role.MONITORING_TEAM || scope.assignment?.role === Role.AUDITOR
        ? { id: scope.assignment.regionId ?? undefined }
        : scope.assignment?.role === Role.DIVISIONAL_MANAGER
          ? { id: scope.assignment.regionId ?? undefined }
          : { id: scope.assignment?.regionId ?? undefined };

    const regions = await this.prisma.region.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        divisions: { orderBy: { name: 'asc' }, include: { areas: true, branches: true, staff: true } },
        areas: { orderBy: { name: 'asc' }, include: { branches: true, staff: true } },
        branches: { orderBy: { name: 'asc' }, include: { staff: true } },
        staff: true,
      },
    });

    if (scope.full || scope.assignment?.role === Role.REGIONAL_MANAGER || scope.assignment?.role === Role.MONITORING_TEAM || scope.assignment?.role === Role.AUDITOR) return regions;

    const assignment = scope.assignment!;
    return regions.map((region) => ({
      ...region,
      divisions: assignment.divisionId ? region.divisions.filter((d) => d.id === assignment.divisionId) : region.divisions,
      areas: assignment.areaId ? region.areas.filter((a) => a.id === assignment.areaId) : region.areas,
      branches: assignment.branchId ? region.branches.filter((b) => b.id === assignment.branchId) : region.branches,
      staff: assignment.branchId ? region.staff.filter((s) => s.branchId === assignment.branchId) : region.staff,
    }));
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
