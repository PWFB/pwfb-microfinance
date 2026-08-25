import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from './staff-scope.service';

const VIEW_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'REGIONAL_MANAGER',
  'DIVISIONAL_MANAGER',
  'MONITORING_TEAM',
  'AUDITOR',
  'AREA_MANAGER',
  'BRANCH_MANAGER',
  'CREDIT_OFFICER',
  'LOAN_OFFICER',
  'TELLER',
  'STAFF',
];

@Controller('access')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccessController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffScopeService: StaffScopeService,
  ) {}

  @Get('hierarchy')
  @Roles(...VIEW_ROLES)
  async hierarchy(@Req() req: any) {
    const scope = await this.staffScopeService.get(req.user);
    let regionWhere: any = undefined;

    if (!scope.global) {
      if (scope.role === 'REGIONAL_MANAGER') {
        regionWhere = { id: scope.staff.regionId };
      } else if (scope.role === 'DIVISIONAL_MANAGER') {
        regionWhere = { divisions: { some: { id: scope.staff.divisionId } } };
      } else if (scope.role === 'AREA_MANAGER') {
        regionWhere = { areas: { some: { id: scope.staff.areaId } } };
      } else {
        regionWhere = { branches: { some: { id: scope.staff.branchId } } };
      }
    }

    const regions = await this.prisma.region.findMany({
      where: regionWhere,
      orderBy: { name: 'asc' },
      include: {
        divisions: {
          orderBy: { name: 'asc' },
          include: {
            areas: {
              orderBy: { name: 'asc' },
              include: {
                branches: {
                  orderBy: { name: 'asc' },
                  include: {
                    staff: {
                      orderBy: { firstName: 'asc' },
                      include: {
                        assignments: {
                          orderBy: { startsAt: 'desc' },
                          include: { region: true, division: true, area: true, branch: true },
                        },
                      },
                    },
                    _count: { select: { customers: true, staff: true, collections: true, payrolls: true } },
                  },
                },
                staff: true,
              },
            },
            staff: true,
          },
        },
        areas: {
          orderBy: { name: 'asc' },
          include: {
            branches: {
              orderBy: { name: 'asc' },
              include: {
                staff: {
                  orderBy: { firstName: 'asc' },
                  include: { assignments: { orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } } },
                },
                _count: { select: { customers: true, staff: true, collections: true, payrolls: true } },
              },
            },
          },
        },
        staff: {
          orderBy: { firstName: 'asc' },
          include: { assignments: { orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } } },
        },
      },
    });

    return {
      scope,
      regions,
      note: 'Visibility follows the authenticated staff hierarchy. Assignment history is retained for staff records.',
    };
  }
}
