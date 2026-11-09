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
});
