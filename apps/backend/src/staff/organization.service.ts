import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly fullRoles: Role[] = [Role.SUPER_ADMIN];

  private async getScope(userId: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        staff: {
          include: {
            assignments: {
              where: {
                active: true,
                startsAt: { lte: now },
                OR: [{ endsAt: null }, { endsAt: { gt: now } }],
              },
              orderBy: { startsAt: 'desc' },
            },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    if (this.fullRoles.includes(user.role)) return { role: user.role, full: true, assignment: null };
    const assignment = user.staff?.assignments[0];
    if (!assignment) throw new ForbiddenException('No active organizational assignment');
    if (assignment.role !== user.role) {
      throw new ForbiddenException('Your login role does not match your active Staff Assignment');
    }
    const requiredTarget: Record<string, string> = {
      ADMIN: 'branchId',
      BRANCH_MANAGER: 'branchId',
      CREDIT_OFFICER: 'branchId',
      TELLER: 'branchId',
      LOAN_OFFICER: 'branchId',
      STAFF: 'branchId',
      AREA_MANAGER: 'areaId',
      DIVISIONAL_MANAGER: 'divisionId',
      REGIONAL_MANAGER: 'regionId',
    };
    const requiredField = requiredTarget[String(user.role)];
    if (requiredField && !assignment[requiredField]) {
      throw new ForbiddenException(`The active ${user.role} assignment is missing its required ${requiredField} target`);
    }
    return { role: user.role, assignment, full: false };
  }

  private branchWhere(scope: any) {
    const assignment = scope.assignment;
    if (assignment?.branchId) return { id: assignment.branchId };
    if (assignment?.areaId) return { areaId: assignment.areaId };
    if (assignment?.divisionId) return { divisionId: assignment.divisionId };
    if (assignment?.regionId) return { regionId: assignment.regionId };
    if (['AUDITOR', 'MONITORING_TEAM'].includes(String(scope.role))) return {};
    return { id: '__no_access__' };
  }

  private async allowedBranches(scope: any) {
    if (scope.full) return null;
    return this.prisma.branch.findMany({
      where: this.branchWhere(scope),
      select: { id: true, regionId: true, divisionId: true, areaId: true },
    });
  }

  private filterHierarchy(regions: any[], branches: any[]) {
    const branchIds = new Set(branches.map((branch) => String(branch.id)));
    const divisionIds = new Set(branches.map((branch) => String(branch.divisionId || '')).filter(Boolean));
    const areaIds = new Set(branches.map((branch) => String(branch.areaId || '')).filter(Boolean));
    const staffInBranches = (staff: any[]) => (staff || []).filter((person) => branchIds.has(String(person.branchId)));

    return regions.map((region) => ({
      ...region,
      divisions: (region.divisions || [])
        .filter((division: any) => divisionIds.has(String(division.id)))
        .map((division: any) => ({
          ...division,
          areas: (division.areas || []).filter((area: any) => areaIds.has(String(area.id))),
          branches: (division.branches || []).filter((branch: any) => branchIds.has(String(branch.id))),
          staff: staffInBranches(division.staff || []),
        })),
      areas: (region.areas || [])
        .filter((area: any) => areaIds.has(String(area.id)))
        .map((area: any) => ({
          ...area,
          branches: (area.branches || []).filter((branch: any) => branchIds.has(String(branch.id))),
          staff: staffInBranches(area.staff || []),
        })),
      branches: (region.branches || []).filter((branch: any) => branchIds.has(String(branch.id))),
      staff: staffInBranches(region.staff || []),
    }));
  }

  private async ensureLegacyBranchHierarchy() {
    const regionCount = await this.prisma.region.count();
    if (regionCount > 0) return;
    const branches = await this.prisma.branch.findMany({ where: { regionId: null }, select: { id: true } });
    if (branches.length === 0) return;
    const region = await this.prisma.region.create({ data: { name: 'PWFB GENERAL REGION', code: 'PWFB-GENERAL' } });
    await this.prisma.branch.updateMany({
      where: { id: { in: branches.map((branch) => branch.id) }, regionId: null },
      data: { regionId: region.id },
    });
  }

  async listForUser(userId: string) {
    const scope = await this.getScope(userId);
    if (scope.full) await this.ensureLegacyBranchHierarchy();
    const branches = await this.allowedBranches(scope);
    if (branches && !branches.length) return [];
    const regionIds = scope.full
      ? undefined
      : Array.from(new Set(branches.map((branch: any) => branch.regionId).filter(Boolean)));
    const regions = await this.prisma.region.findMany({
      where: scope.full ? {} : { id: { in: regionIds || [] } },
      orderBy: { name: 'asc' },
      include: {
        divisions: { orderBy: { name: 'asc' }, include: { areas: true, branches: true, staff: true } },
        areas: { orderBy: { name: 'asc' }, include: { branches: true, staff: true } },
        branches: { orderBy: { name: 'asc' }, include: { staff: true } },
        staff: true,
      },
    });
    return scope.full ? regions : this.filterHierarchy(regions, branches || []);
  }

  /**
   * Super Admin sees the complete branch register. Other administrators receive
   * only the branches allowed by their current active StaffAssignment.
   */
  async registrationHierarchy(userId: string) {
    const scope = await this.getScope(userId);
    if (scope.full) await this.ensureLegacyBranchHierarchy();
    const branches = await this.allowedBranches(scope);
    if (branches && !branches.length) return { regions: [], unassignedBranches: [] };
    const branchIds = branches ? branches.map((branch: any) => String(branch.id)) : null;
    const [regions, unassignedBranches] = await Promise.all([
      this.prisma.region.findMany({
        where: scope.full ? { active: true } : { id: { in: Array.from(new Set((branches || []).map((branch: any) => branch.regionId).filter(Boolean))) } },
        orderBy: { name: 'asc' },
        include: {
          divisions: {
            where: { active: true },
            orderBy: { name: 'asc' },
            include: {
              areas: { where: { active: true }, orderBy: { name: 'asc' }, include: { branches: true } },
              branches: { orderBy: { name: 'asc' } },
            },
          },
          areas: { where: { active: true }, orderBy: { name: 'asc' }, include: { branches: true } },
          branches: { orderBy: { name: 'asc' } },
        },
      }),
      this.prisma.branch.findMany({
        where: scope.full ? { regionId: null } : { id: { in: branchIds || [] }, regionId: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, address: true, regionId: true, divisionId: true, areaId: true },
      }),
    ]);
    if (scope.full) return { regions, unassignedBranches };
    const filtered = this.filterHierarchy(regions, branches || []);
    return { regions: filtered, unassignedBranches };
  }

  async createRegion(body: { name: string; code?: string }, userId: string) {
    const scope = await this.getScope(userId);
    if (!scope.full) throw new ForbiddenException('Only Super Admin can create an organization-wide region');
    return this.prisma.region.create({ data: { name: body.name, code: body.code } });
  }

  async createDivision(body: { name: string; regionId: string }, userId: string) {
    const scope = await this.getScope(userId);
    if (!scope.full && !(scope.role === 'REGIONAL_MANAGER' && scope.assignment?.regionId === body.regionId)) {
      throw new ForbiddenException('You can only create a division inside your assigned region');
    }
    return this.prisma.division.create({ data: { name: body.name, regionId: body.regionId } });
  }

  async createArea(body: { name: string; regionId: string; divisionId?: string }, userId: string) {
    const scope = await this.getScope(userId);
    const canManageRegion = scope.role === 'REGIONAL_MANAGER' && scope.assignment?.regionId === body.regionId;
    const canManageDivision = scope.role === 'DIVISIONAL_MANAGER'
      && scope.assignment?.regionId === body.regionId
      && scope.assignment?.divisionId === body.divisionId;
    if (!scope.full && !canManageRegion && !canManageDivision) {
      throw new ForbiddenException('You can only create an area inside your assigned region or division');
    }
    return this.prisma.area.create({ data: { name: body.name, regionId: body.regionId, divisionId: body.divisionId } });
  }

  async regionStaff(regionId: string, userId: string) {
    const scope = await this.getScope(userId);
    const region = await this.prisma.region.findUnique({ where: { id: regionId }, select: { id: true } });
    if (!region) throw new NotFoundException('Region not found');
    if (scope.full) {
      return this.prisma.staff.findMany({
        where: { regionId }, orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
        include: { branch: true, department: true, assignments: { orderBy: { startsAt: 'desc' } } },
      });
    }
    const branches = await this.allowedBranches(scope);
    const allowedBranchIds = (branches || []).map((branch: any) => String(branch.id));
    if (!allowedBranchIds.length) return [];
    const allowedRegionIds = new Set((branches || []).map((branch: any) => branch.regionId).filter(Boolean));
    if (!allowedRegionIds.has(regionId)) throw new ForbiddenException('Region is outside your active organizational assignment');
    return this.prisma.staff.findMany({
      where: { regionId, branchId: { in: allowedBranchIds } },
      orderBy: [{ position: 'asc' }, { lastName: 'asc' }],
      include: { branch: true, department: true, assignments: { orderBy: { startsAt: 'desc' } } },
    });
  }
}
