import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerVirtualAccountService } from '../banking/customer-virtual-account.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: {},
        },
        { provide: CustomerVirtualAccountService, useValue: {} },
        { provide: AccessScopeService, useValue: { getScope: jest.fn(), filterList: jest.fn(), assertCustomer: jest.fn() } },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('CustomersService registration assignment protection', () => {
  function setup(customer: any, assignedStaff: any = null, group: any = null) {
    const tx = {
      customer: { update: jest.fn().mockResolvedValue({ ...customer, ...assignedStaff }) },
      user: { update: jest.fn() },
    };
    const prisma: any = {
      customer: { findUnique: jest.fn().mockResolvedValue(customer) },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      staff: { findUnique: jest.fn().mockResolvedValue(assignedStaff) },
      clientGroup: { findUnique: jest.fn().mockResolvedValue(group) },
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
    };
    const accessScope = {
      assertBranch: jest.fn().mockResolvedValue(undefined),
      assertStaff: jest.fn().mockResolvedValue(undefined),
      assertCustomer: jest.fn().mockResolvedValue(undefined),
    };
    return {
      service: new CustomersService(prisma, {} as any, accessScope as any),
      prisma,
      tx,
      accessScope,
    };
  }

  it('does not allow a populated customer branch to be reassigned', async () => {
    const customer = {
      id: 'customer-1',
      branchId: 'branch-1',
      assignedStaffId: 'staff-1',
      groupId: 'group-1',
      firstName: 'Ada',
      lastName: 'Client',
      middleName: null,
      email: 'ada@example.test',
      phone: '08000000000',
      userId: null,
    };
    const { service, prisma, tx } = setup(customer);

    await expect(service.update('customer-1', { branchId: 'branch-2' } as any, { role: 'SUPER_ADMIN' }))
      .rejects.toThrow('immutable registration assignment');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(tx.customer.update).not.toHaveBeenCalled();
  });

  it('allows only Super Admin to backfill a missing assigned officer in the same branch', async () => {
    const customer = {
      id: 'customer-1',
      branchId: 'branch-1',
      assignedStaffId: null,
      groupId: null,
      firstName: 'Ada',
      lastName: 'Client',
      middleName: null,
      email: 'ada@example.test',
      phone: '08000000000',
      userId: null,
    };
    const staff = { id: 'staff-1', branchId: 'branch-1' };
    const { service, accessScope, tx } = setup(customer, staff);

    await service.update('customer-1', { assignedStaffId: 'staff-1' } as any, { role: 'SUPER_ADMIN' });

    expect(accessScope.assertStaff).toHaveBeenCalledWith({ role: 'SUPER_ADMIN' }, 'staff-1');
    expect(tx.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'customer-1' },
      data: expect.objectContaining({ assignedStaffId: 'staff-1' }),
    }));
  });

  it('does not allow a branch admin to fill a missing registration assignment', async () => {
    const customer = {
      id: 'customer-1',
      branchId: 'branch-1',
      assignedStaffId: null,
      groupId: null,
      firstName: 'Ada',
      lastName: 'Client',
      middleName: null,
      email: 'ada@example.test',
      phone: '08000000000',
      userId: null,
    };
    const { service, prisma } = setup(customer, { id: 'staff-1', branchId: 'branch-1' });

    await expect(service.update('customer-1', { assignedStaffId: 'staff-1' } as any, { role: 'ADMIN' }))
      .rejects.toThrow('Only Super Admin may backfill');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
