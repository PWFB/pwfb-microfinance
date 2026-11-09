import { ForbiddenException } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';

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
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'customer-a', branchId: 'branch-a', assignedStaffId: 'staff-a' }]);
    await expect(service.assertCustomer({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'customer-a')).resolves.toBe(true);

    query
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'customer-b', branchId: 'branch-a', assignedStaffId: 'staff-b' }]);
    await expect(service.assertCustomer({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'customer-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies Credit Officers access to another staff member or another officer collection', async () => {
    query
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'staff-b', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertStaff({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'staff-b')).rejects.toBeInstanceOf(ForbiddenException);

    query
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'collection-b', branchId: 'branch-a', staffId: 'staff-b', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertCollection({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'collection-b')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still allows a Credit Officer to access branch metadata for assigned-branch operations', async () => {
    query
      .mockResolvedValueOnce([{ id: 'staff-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }])
      .mockResolvedValueOnce([{ id: 'branch-a', branchId: 'branch-a', areaId: null, divisionId: null, regionId: null }]);
    await expect(service.assertBranch({ id: 'user-a', role: 'CREDIT_OFFICER' }, 'branch-a')).resolves.toBe(true);
  });
});
