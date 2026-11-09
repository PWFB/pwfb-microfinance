import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { lastValueFrom, of } from 'rxjs';

describe('AccessScopeService', () => {
  let query: jest.Mock;
  let assignments: jest.Mock;
  let branches: jest.Mock;
  let service: AccessScopeService;

  beforeEach(() => {
    query = jest.fn();
    assignments = jest.fn().mockResolvedValue([]);
    branches = jest.fn().mockResolvedValue([]);
    service = new AccessScopeService({
      $queryRawUnsafe: query,
      staffAssignment: { findMany: assignments },
      branch: { findMany: branches },
    } as any);
  });

  it('grants global scope only to Super Admin', async () => {
    await expect(service.getScope({ id: 'root', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ global: true });
    query.mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.getScope({ id: 'admin-user', role: 'ADMIN' })).resolves.toMatchObject({
      global: false, staffId: 'staff-a', branchId: 'branch-a',
    });
  });

  it('allows a Credit Officer to access their own customer but denies another officer customer in the same branch', async () => {
    query
      .mockResolvedValueOnce([{ id: 'customer-a', branchId: 'branch-a', assignedStaffId: 'staff-a' }])
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertCustomer({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'customer-a')).resolves.toBe(true);

    query
      .mockResolvedValueOnce([{ id: 'customer-b', branchId: 'branch-a', assignedStaffId: 'staff-b' }])
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertCustomer({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'customer-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies Credit Officers access to another staff member or another officer collection', async () => {
    query.mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertStaff({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'staff-b')).rejects.toBeInstanceOf(ForbiddenException);

    query
      .mockResolvedValueOnce([{ id: 'collection-b', branchId: 'branch-a', staffId: 'staff-b', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertCollection({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'collection-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access to ledger transactions belonging to another officer customer', async () => {
    query
      .mockResolvedValueOnce([{ id: 'transaction-b', branchId: 'branch-a', assignedStaffId: 'staff-b', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertTransaction({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'transaction-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still allows a Credit Officer to access branch metadata for assigned-branch operations', async () => {
    query
      .mockResolvedValueOnce([{ id: 'branch-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertBranch({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'branch-a')).resolves.toBe(true);
  });
  it('fails closed when the authenticated user and Staff record point to different staff identities', async () => {
    query.mockResolvedValueOnce([{
      id: 'staff-actual',
      branchId: 'branch-a',
      areaId: null,
      divisionId: null,
      regionId: null,
    }]);

    await expect(service.getScope({
      id: 'user-a',
      staffId: 'staff-claimed',
      role: 'TELLER',
    })).rejects.toThrow('Staff identity links do not match');
  });

  it('uses the active assignment matching the authenticated role before staff profile fallback', async () => {
    query.mockResolvedValueOnce([{
      id: 'staff-manager', branchId: 'branch-assigned', areaId: 'area-assigned',
      divisionId: 'division-assigned', regionId: 'region-assigned',
    }]);
    await expect(service.getScope({ id: 'manager-user', role: 'AREA_MANAGER' })).resolves.toMatchObject({
      staffId: 'staff-manager', branchId: 'branch-assigned', areaId: 'area-assigned',
      divisionId: 'division-assigned', regionId: 'region-assigned', global: false,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM "StaffAssignment"'),
      'manager-user',
      'AREA_MANAGER',
    );
    expect(query.mock.calls[0][0]).toContain('a."active" = TRUE');
    expect(query.mock.calls[0][0]).toContain('a."startsAt" <= CURRENT_TIMESTAMP');
    expect(assignments).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ staffId: 'staff-manager', role: 'AREA_MANAGER', active: true }),
    }));
  });

  it('returns all active area assignments without broadening an Area Manager to the staff profile region', async () => {
    query.mockResolvedValueOnce([{
      id: 'staff-manager', branchId: 'home-branch', areaId: 'profile-area',
      divisionId: 'profile-division', regionId: 'profile-region',
    }]);
    assignments.mockResolvedValueOnce([
      { branchId: 'assigned-branch-a', areaId: 'area-a', divisionId: 'division-a', regionId: 'region-a' },
      { branchId: 'assigned-branch-b', areaId: 'area-b', divisionId: 'division-b', regionId: 'region-b' },
    ]);
    branches.mockResolvedValueOnce([{ id: 'home-branch' }, { id: 'assigned-branch-a' }, { id: 'assigned-branch-b' }, { id: 'area-a-branch' }, { id: 'area-b-branch' }]);

    await expect(service.getScopedBranchIds({ id: 'manager-user', role: 'AREA_MANAGER' }))
      .resolves.toEqual(['home-branch', 'assigned-branch-a', 'assigned-branch-b', 'area-a-branch', 'area-b-branch']);

    const branchWhere = branches.mock.calls[0][0].where;
    expect(branchWhere.OR).toEqual(expect.arrayContaining([
      { id: { in: expect.arrayContaining(['home-branch', 'assigned-branch-a', 'assigned-branch-b']) } },
      { areaId: { in: expect.arrayContaining(['profile-area', 'area-a', 'area-b']) } },
    ]));
    expect(branchWhere.OR).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ regionId: expect.anything() }),
    ]));
  });

  it('denies a repayment associated with another officer customer', async () => {
    query
      .mockResolvedValueOnce([{
        id: 'repayment-b', branchId: 'branch-a', assignedStaffId: 'staff-b',
        areaId: null, divisionId: null, regionId: null,
      }])
      .mockResolvedValueOnce([{
        id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null,
      }]);
    await expect(service.assertRepayment({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'repayment-b'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

});
describe('AccessScopeInterceptor async response filtering', () => {
  it('awaits the access-scope database filter before emitting a list response', async () => {
    const filterList = jest.fn().mockResolvedValue([{ id: 'customer-own' }]);
    const interceptor = new AccessScopeInterceptor({ filterList } as any);
    const user = { id: 'officer-user', role: 'CREDIT_OFFICER' };
    const request = { user, originalUrl: '/customers', path: '/customers', route: { path: '/customers' }, params: {}, query: {}, body: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
    const handler = {
      handle: () => of([
        { id: 'customer-own' },
        { id: 'customer-other' },
      ]),
    } as any;

    const response$ = await interceptor.intercept(context, handler);
    const response = await lastValueFrom(response$ as any);

    expect(filterList).toHaveBeenCalledWith(user, 'customers', [
      { id: 'customer-own' },
      { id: 'customer-other' },
    ]);
    expect(response).toEqual([{ id: 'customer-own' }]);
    expect(response).not.toBeInstanceOf(Promise);
  });
});

