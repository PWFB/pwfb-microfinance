import { ForbiddenException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService authorization', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    branch: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn(), findFirst: jest.fn() },
    clientGroup: { findUnique: jest.fn() },
  } as any;

  const scope = {
    assertCustomerAccess: jest.fn(),
    get: jest.fn(),
    assertBranchAccess: jest.fn(),
    staffWhere: jest.fn(),
  } as any;

  let service: CustomersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CustomersService(prisma, scope);
  });

  it('blocks moving an accessible customer to a branch outside the actor scope', async () => {
    scope.assertCustomerAccess.mockResolvedValue({ id: 'cus-1' });
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cus-1',
      branchId: 'branch-a',
      userId: null,
      firstName: 'Ada',
      middleName: null,
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '08000000000',
    });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-b' });
    scope.get.mockResolvedValue({ global: false, role: 'BRANCH_MANAGER', staff: { branchId: 'branch-a' } });
    scope.assertBranchAccess.mockRejectedValue(
      new ForbiddenException('You do not have access to this branch'),
    );

    await expect(
      service.update('cus-1', { branchId: 'branch-b' } as any, {
        id: 'user-a',
        role: 'BRANCH_MANAGER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(scope.assertCustomerAccess).toHaveBeenCalledWith(
      { id: 'user-a', role: 'BRANCH_MANAGER' },
      'cus-1',
    );
    expect(scope.assertBranchAccess).toHaveBeenCalledWith(
      { id: 'user-a', role: 'BRANCH_MANAGER' },
      'branch-b',
    );
  });

  it('blocks assigning a customer to staff outside the actor scope', async () => {
    scope.assertCustomerAccess.mockResolvedValue({ id: 'cus-1' });
    prisma.customer.findUnique.mockResolvedValue({
      id: 'cus-1',
      branchId: 'branch-a',
      userId: null,
      firstName: 'Ada',
      middleName: null,
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '08000000000',
    });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-a' });
    scope.get.mockResolvedValue({ global: false, role: 'BRANCH_MANAGER', staff: { branchId: 'branch-a' } });
    scope.assertBranchAccess.mockResolvedValue({ id: 'branch-a' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff-b', branchId: 'branch-a' });
    scope.staffWhere.mockResolvedValue({ branchId: 'branch-a' });
    prisma.staff.findFirst.mockResolvedValue(null);

    await expect(
      service.update('cus-1', { assignedStaffId: 'staff-b' } as any, {
        id: 'user-a',
        role: 'BRANCH_MANAGER',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.staff.findFirst).toHaveBeenCalled();
  });
});
