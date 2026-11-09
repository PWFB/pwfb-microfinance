import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CallsService } from './calls.service';

describe('CallsService access and permission boundaries', () => {
  const makeService = () => {
    const prisma: any = {};
    const scope: any = {};
    return { service: new CallsService(prisma, scope), prisma, scope };
  };

  it('rejects call permission changes from staff accounts', async () => {
    const { service } = makeService();
    await expect(service.setClientCallPermission(
      { id: 'staff-user', role: 'TELLER', staffId: 'staff-1' }, true,
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires explicit boolean opt-in', async () => {
    const { service } = makeService();
    await expect(service.setClientCallPermission(
      { id: 'client-user', role: 'CUSTOMER', customerId: 'customer-1' }, 'yes' as any,
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses calls to clients who have not enabled call permission', async () => {
    const { service, scope, prisma } = makeService();
    scope.getScope = jest.fn().mockResolvedValue({ role: 'TELLER', staffId: 'staff-1', branchId: 'branch-1', global: false });
    scope.assertCustomer = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{
      id: 'customer-1', branchId: 'branch-1', phone: '08000000000', userId: 'client-user', callEnabled: false,
    }]);
    await expect(service.startClientCall(
      { id: 'staff-user', role: 'TELLER', staffId: 'staff-1' }, 'customer-1',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('never allows a customer account to initiate a staff or client call', async () => {
    const { service } = makeService();
    await expect(service.startClientCall(
      { id: 'client-user', role: 'CUSTOMER', customerId: 'customer-1' }, 'customer-2',
    )).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows internal staff calls across branches without exposing staff phone numbers', async () => {
    const { service, scope, prisma } = makeService();
    scope.getScope = jest.fn().mockResolvedValue({
      role: 'TELLER', staffId: 'staff-1', branchId: 'branch-1', global: false,
    });
    scope.assertStaff = jest.fn().mockRejectedValue(new Error('Cross-branch staff lookup should not be blocked'));
    scope.assertBranch = jest.fn().mockRejectedValue(new Error('Cross-branch call should be permitted'));
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{
      staffId: 'staff-2', branchId: 'branch-2', userId: 'user-2',
    }]);
    (service as any).createSession = jest.fn().mockResolvedValue({ ok: true, call: { id: 'call-1' } });

    await expect(service.startStaffCall(
      { id: 'user-1', role: 'TELLER', staffId: 'staff-1' },
      'staff-2',
    )).resolves.toMatchObject({ ok: true });
    expect(scope.assertStaff).not.toHaveBeenCalled();
    expect(scope.assertBranch).not.toHaveBeenCalled();
    expect((service as any).createSession).toHaveBeenCalledWith(expect.objectContaining({
      type: 'STAFF',
      branchId: 'branch-2',
      callerUserId: 'user-1',
      recipientUserId: 'user-2',
    }));
  });

});