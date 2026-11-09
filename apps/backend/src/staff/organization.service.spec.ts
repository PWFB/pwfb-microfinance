import { ForbiddenException } from '@nestjs/common';
import { OrganizationService } from './organization.service';

describe('OrganizationService active assignment hierarchy', () => {
  const branchOne = { id: 'branch-1', name: 'Branch One', regionId: 'region-1', divisionId: 'division-1', areaId: 'area-1' };
  const branchTwo = { id: 'branch-2', name: 'Branch Two', regionId: 'region-1', divisionId: 'division-1', areaId: 'area-1' };
  const staffOne = { id: 'staff-1', branchId: 'branch-1' };
  const staffTwo = { id: 'staff-2', branchId: 'branch-2' };
  const regionTree = [{
    id: 'region-1',
    name: 'Region One',
    divisions: [{
      id: 'division-1',
      areas: [{ id: 'area-1', branches: [branchOne, branchTwo], staff: [staffOne, staffTwo] }],
      branches: [branchOne, branchTwo],
      staff: [staffOne, staffTwo],
    }],
    areas: [{ id: 'area-1', branches: [branchOne, branchTwo], staff: [staffOne, staffTwo] }],
    branches: [branchOne, branchTwo],
    staff: [staffOne, staffTwo],
  }];

  const prisma: any = {
    user: { findUnique: jest.fn() },
    branch: { findMany: jest.fn() },
    region: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    division: { create: jest.fn() },
    area: { create: jest.fn() },
    staff: { findMany: jest.fn() },
  };
  let service: OrganizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-user',
      role: 'BRANCH_MANAGER',
      staff: {
        assignments: [{
          role: 'BRANCH_MANAGER',
          active: true,
          branchId: 'branch-1',
          areaId: 'area-1',
          divisionId: 'division-1',
          regionId: 'region-1',
        }],
      },
    });
    prisma.branch.findMany.mockResolvedValue([branchOne]);
    prisma.region.findMany.mockResolvedValue(regionTree);
    service = new OrganizationService(prisma);
  });

  it('returns only the exact branch, area, division and staff records assigned to a Branch Manager', async () => {
    const result = await service.listForUser('manager-user');

    expect(prisma.branch.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'branch-1' },
    }));
    expect(result).toHaveLength(1);
    expect(result[0].branches.map((branch: any) => branch.id)).toEqual(['branch-1']);
    expect(result[0].staff.map((staff: any) => staff.id)).toEqual(['staff-1']);
    expect(result[0].divisions).toHaveLength(1);
    expect(result[0].divisions[0].branches.map((branch: any) => branch.id)).toEqual(['branch-1']);
    expect(result[0].areas[0].branches.map((branch: any) => branch.id)).toEqual(['branch-1']);
  });

  it('rejects hierarchy access when the active assignment role does not match the login role', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'manager-user',
      role: 'BRANCH_MANAGER',
      staff: { assignments: [{ role: 'CREDIT_OFFICER', active: true, branchId: 'branch-1' }] },
    });

    await expect(service.listForUser('manager-user')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
