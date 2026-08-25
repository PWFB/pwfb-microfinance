import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const GLOBAL_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MONITORING_TEAM', 'AUDITOR']);
const ROLE_LEVELS: Record<string, string> = {
  REGIONAL_MANAGER: 'region',
  DIVISIONAL_MANAGER: 'division',
  AREA_MANAGER: 'area',
  BRANCH_MANAGER: 'branch',
  CREDIT_OFFICER: 'branch',
  LOAN_OFFICER: 'branch',
  TELLER: 'branch',
  STAFF: 'branch',
};

@Injectable()
export class StaffScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async get(authUser: any) {
    const userId = authUser?.id ?? authUser?.sub;
    if (!userId) throw new UnauthorizedException('Authentication required');
    if (GLOBAL_ROLES.has(authUser?.role)) {
      return { role: authUser.role, global: true, staff: null };
    }

    const staff = await this.prisma.staff.findFirst({
      where: { userId },
      select: { id: true, branchId: true, regionId: true, divisionId: true, areaId: true },
    });

    if (!staff) throw new ForbiddenException('Staff assignment not found');
    return { role: authUser.role, global: false, staff };
  }

  async customerWhere(authUser: any) {
    const scope = await this.get(authUser);
    if (scope.global) return {};

    const level = ROLE_LEVELS[scope.role];
    if (level === 'region') return { branch: { regionId: scope.staff.regionId } };
    if (level === 'division') return { branch: { divisionId: scope.staff.divisionId } };
    if (level === 'area') return { branch: { areaId: scope.staff.areaId } };
    return { branchId: scope.staff.branchId };
  }

  async loanWhere(authUser: any) {
    const customer = await this.customerWhere(authUser);
    return Object.keys(customer).length ? { customer } : {};
  }

  /**
   * Staff visibility follows the organizational hierarchy and includes
   * historical assignments, so managers can see staff who previously
   * worked within their region/division/area/branch.
   */
  async staffWhere(authUser: any) {
    const scope = await this.get(authUser);
    if (scope.global) return {};

    const level = ROLE_LEVELS[scope.role];
    if (level === 'region') {
      return { OR: [{ regionId: scope.staff.regionId }, { assignments: { some: { regionId: scope.staff.regionId } } }] };
    }
    if (level === 'division') {
      return { OR: [{ divisionId: scope.staff.divisionId }, { assignments: { some: { divisionId: scope.staff.divisionId } } }] };
    }
    if (level === 'area') {
      return { OR: [{ areaId: scope.staff.areaId }, { assignments: { some: { areaId: scope.staff.areaId } } }] };
    }
    return { OR: [{ branchId: scope.staff.branchId }, { assignments: { some: { branchId: scope.staff.branchId } } }] };
  }

  async assertCustomerAccess(authUser: any, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, ...(await this.customerWhere(authUser)) },
      select: { id: true },
    });
    if (!customer) throw new ForbiddenException('You do not have access to this customer or branch');
    return customer;
  }

  async assertLoanAccess(authUser: any, loanId: string) {
    const loan = await this.prisma.loan.findFirst({
      where: { id: loanId, ...(await this.loanWhere(authUser)) },
      select: { id: true, customerId: true },
    });
    if (!loan) throw new ForbiddenException('You do not have access to this loan or branch');
    return loan;
  }
}
