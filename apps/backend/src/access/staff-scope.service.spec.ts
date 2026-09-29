import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { StaffScopeService } from './staff-scope.service';

describe('StaffScopeService', () => {
  const prisma = {
    staff: { findFirst: jest.fn() },
    branch: { findFirst: jest.fn() },
    customer: { findFirst: jest.fn() },
    loan: { findFirst: jest.fn() },
  } as any;

  let service: StaffScopeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StaffScopeService(prisma);
  });

  it('rejects unauthenticated users', async () => {
    await expect(service.get(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps global roles unrestricted', async () => {
    await expect(service.get({ id: 'u1', role: 'ADMIN' })).resolves.toEqual({
      role: 'ADMIN',
      global: true,
      staff: null,
    });
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
  });

  it('scopes branch roles to their assigned branch', async () => {
    prisma.staff.findFirst.mockResolvedValue({
      id: 's1',
      branchId: 'b1',
      regionId: 'r1',
      divisionId: 'd1',
      areaId: 'a1',
    });

    await expect(service.customerWhere({ id: 'u1', role: 'BRANCH_MANAGER' })).resolves.toEqual({
      branchId: 'b1',
    });
  });

  it('scopes regional managers to their region', async () => {
    prisma.staff.findFirst.mockResolvedValue({
      id: 's1',
      branchId: 'b1',
      regionId: 'r1',
      divisionId: 'd1',
      areaId: 'a1',
    });

    await expect(service.customerWhere({ id: 'u1', role: 'REGIONAL_MANAGER' })).resolves.toEqual({
      branch: { regionId: 'r1' },
    });
  });

  it('denies a branch-scoped user access to another branch', async () => {
    prisma.staff.findFirst.mockResolvedValue({
      id: 's1',
      branchId: 'b1',
      regionId: 'r1',
      divisionId: 'd1',
      areaId: 'a1',
    });
    prisma.branch.findFirst.mockResolvedValue(null);

    await expect(
      service.assertBranchAccess({ id: 'u1', role: 'BRANCH_MANAGER' }, 'b2'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: 'b2', id: 'b1' },
      select: { id: true },
    });
  });

  it('allows a branch-scoped user to access their own branch', async () => {
    prisma.staff.findFirst.mockResolvedValue({
      id: 's1',
      branchId: 'b1',
      regionId: 'r1',
      divisionId: 'd1',
      areaId: 'a1',
    });
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });

    await expect(
      service.assertBranchAccess({ id: 'u1', role: 'BRANCH_MANAGER' }, 'b1'),
    ).resolves.toEqual({ id: 'b1' });
  });
});
