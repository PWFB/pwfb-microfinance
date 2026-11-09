import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { lastValueFrom, of } from 'rxjs';

describe('AccessScopeService', () => {
  let query: jest.Mock;
  let service: AccessScopeService;

  beforeEach(() => {
    query = jest.fn();
    service = new AccessScopeService({ $queryRawUnsafe: query } as any);
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

