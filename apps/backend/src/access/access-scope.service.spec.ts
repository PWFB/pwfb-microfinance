import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { lastValueFrom, of } from 'rxjs';

describe('AccessScopeService active staff assignment scope', () => {
  let query: jest.Mock;
  let service: AccessScopeService;

  const staff = { id: 'staff-a' };
  const creditAssignment = {
    role: 'CREDIT_OFFICER',
    branchId: 'branch-assigned',
    areaId: 'area-assigned',
    divisionId: 'division-assigned',
    regionId: 'region-assigned',
  };

  beforeEach(() => {
    query = jest.fn(async (sql: string, ...args: any[]) => {
      if (sql.includes('FROM "StaffAssignment"')) return [creditAssignment];
      if (sql.includes('FROM "Staff"')) return [staff];
      if (sql.includes('FROM "Customer" c')) return [{ id: args[0], branchId: 'branch-assigned', assignedStaffId: 'staff-a' }];
      if (sql.includes('FROM "DailyCollection" dc')) return [{ id: args[0], branchId: 'branch-assigned', staffId: 'staff-a', areaId: 'area-assigned', divisionId: 'division-assigned', regionId: 'region-assigned' }];
      if (sql.includes('FROM "Transaction" t')) return [{ id: args[0], branchId: 'branch-assigned', assignedStaffId: 'staff-a', areaId: 'area-assigned', divisionId: 'division-assigned', regionId: 'region-assigned' }];
      if (sql.includes('FROM "Branch"')) return [{ id: 'branch-assigned', branchId: 'branch-assigned', areaId: 'area-assigned', divisionId: 'division-assigned', regionId: 'region-assigned' }];
      return [];
    });
    service = new AccessScopeService({ $queryRawUnsafe: query } as any);
  });

  it('grants global scope only to Super Admin', async () => {
    await expect(service.getScope({ id: 'root', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ global: true });
  });

  it('uses the active assignment as the authoritative branch target, not stale Staff profile fields', async () => {
    const result = await service.getScope({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' });
    expect(result).toMatchObject({
      global: false,
      staffId: 'staff-a',
      branchId: 'branch-assigned',
      areaId: 'area-assigned',
      divisionId: 'division-assigned',
      regionId: 'region-assigned',
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM "StaffAssignment"'), 'staff-a');
  });

  it('rejects an account when its login role differs from its active Staff Assignment', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "StaffAssignment"')) return [{ ...creditAssignment, role: 'TELLER' }];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.getScope({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }))
      .rejects.toThrow('login role does not match');
  });

  it('fails closed when a staff account has no active assignment', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "StaffAssignment"')) return [];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.getScope({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }))
      .rejects.toThrow('No active Staff Assignment');
  });

  it('allows a Credit Officer to access their own customer but denies another officer customer in the same branch', async () => {
    query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.includes('FROM "Customer" c')) return [{ id: args[0], branchId: 'branch-assigned', assignedStaffId: args[0] === 'customer-a' ? 'staff-a' : 'staff-b' }];
      if (sql.includes('FROM "StaffAssignment"')) return [creditAssignment];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.assertCustomer({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }, 'customer-a')).resolves.toBe(true);
    await expect(service.assertCustomer({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }, 'customer-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies Credit Officers access to another staff member or another officer collection', async () => {
    await expect(service.assertStaff({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }, 'staff-b'))
      .rejects.toBeInstanceOf(ForbiddenException);

    query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.includes('FROM "DailyCollection" dc')) return [{ id: args[0], branchId: 'branch-assigned', staffId: 'staff-b', areaId: 'area-assigned', divisionId: 'division-assigned', regionId: 'region-assigned' }];
      if (sql.includes('FROM "StaffAssignment"')) return [creditAssignment];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.assertCollection({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }, 'collection-b'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies access to ledger transactions belonging to another officer customer', async () => {
    query.mockImplementation(async (sql: string, ...args: any[]) => {
      if (sql.includes('FROM "Transaction" t')) return [{ id: args[0], branchId: 'branch-assigned', assignedStaffId: 'staff-b', areaId: 'area-assigned', divisionId: 'division-assigned', regionId: 'region-assigned' }];
      if (sql.includes('FROM "StaffAssignment"')) return [creditAssignment];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.assertTransaction({ id: 'user-a', staffId: 'staff-a', role: 'CREDIT_OFFICER' }, 'transaction-b'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves a branch role to its assigned branch, not the stale Staff branch', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "StaffAssignment"')) return [{ role: 'BRANCH_MANAGER', branchId: 'branch-new', areaId: null, divisionId: null, regionId: null }];
      if (sql.includes('FROM "Staff"')) return [staff];
      return [];
    });
    await expect(service.getScopedBranchIds({ id: 'manager-user', staffId: 'staff-a', role: 'BRANCH_MANAGER' }))
      .resolves.toEqual(['branch-new']);
  });

  it('gives an un-narrowed Auditor a read scope across branches', async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM "StaffAssignment"')) return [{ role: 'AUDITOR', branchId: null, areaId: null, divisionId: null, regionId: null }];
      if (sql.includes('FROM "Staff"')) return [staff];
      if (sql.includes('FROM "Branch"')) return [{ id: 'branch-a' }, { id: 'branch-b' }];
      return [];
    });
    await expect(service.getScopedBranchIds({ id: 'auditor-user', staffId: 'staff-a', role: 'AUDITOR' }))
      .resolves.toEqual(['branch-a', 'branch-b']);
  });

  it('fails closed when authenticated user and Staff record point to different staff identities', async () => {
    query.mockImplementation(async (sql: string) => sql.includes('FROM "Staff"') ? [{ id: 'staff-actual' }] : []);
    await expect(service.getScope({ id: 'user-a', staffId: 'staff-claimed', role: 'TELLER' }))
      .rejects.toThrow('Staff identity links do not match');
  });
});

describe('AccessScopeInterceptor async response filtering', () => {
  it('awaits the access-scope database filter before emitting a list response', async () => {
    const filterList = jest.fn().mockResolvedValue([{ id: 'customer-own' }]);
    const interceptor = new AccessScopeInterceptor({ filterList } as any);
    const user = { id: 'officer-user', role: 'CREDIT_OFFICER' };
    const request = { user, originalUrl: '/customers', path: '/customers', route: { path: '/customers' }, params: {}, query: {}, body: {} };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as any;
    const handler = { handle: () => of([{ id: 'customer-own' }, { id: 'customer-other' }]) } as any;

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
