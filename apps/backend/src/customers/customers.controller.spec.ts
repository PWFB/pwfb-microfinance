import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('CustomersController', () => {
  let controller: CustomersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: { verifyMyIdentifier: jest.fn(), verifyCustomerIdentifier: jest.fn(), },
        },
        { provide: AccessScopeService, useValue: { assertCustomer: jest.fn().mockResolvedValue(undefined) }
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
  });


  it('allows a customer to request only their own BVN/NIN verification with explicit consent', async () => {
    const service = {
      verifyMyIdentifier: jest.fn().mockResolvedValue({ status: 'VERIFIED', type: 'NIN' }),
    };
    const scopedController = new CustomersController(service as any, {} as any);
    const user = { id: 'customer-user-1', role: 'CUSTOMER' };

    await expect(scopedController.verifyMyIdentity(
      'NIN',
      { value: '12345678901', consentConfirmed: true },
      { user },
    )).resolves.toEqual({ status: 'VERIFIED', type: 'NIN' });

    expect(service.verifyMyIdentifier).toHaveBeenCalledWith(
      'NIN',
      '12345678901',
      true,
      user,
    );
  });

  it('forwards scoped staff-assisted identity checks to the customer service', async () => {
    const service = {
      verifyCustomerIdentifier: jest.fn().mockResolvedValue({ status: 'MISMATCH', type: 'BVN' }),
    };
    const scopedController = new CustomersController(service as any, {} as any);
    const user = { id: 'officer-user-1', role: 'CREDIT_OFFICER' };

    await expect(scopedController.verifyCustomerIdentifier(
      'customer-1',
      'BVN',
      { value: '11111111111', consentConfirmed: true },
      { user },
    )).resolves.toEqual({ status: 'MISMATCH', type: 'BVN' });

    expect(service.verifyCustomerIdentifier).toHaveBeenCalledWith(
      'customer-1',
      'BVN',
      '11111111111',
      true,
      user,
    );
  });

  it('does not infer identity consent from an omitted consent field', async () => {
    const service = {
      verifyMyIdentifier: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    };
    const scopedController = new CustomersController(service as any, {} as any);

    await scopedController.verifyMyIdentity(
      'BVN',
      { value: '11111111111' },
      { user: { id: 'customer-user-1', role: 'CUSTOMER' } },
    );

    expect(service.verifyMyIdentifier).toHaveBeenCalledWith(
      'BVN',
      '11111111111',
      false,
      { id: 'customer-user-1', role: 'CUSTOMER' },
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('passes the authenticated user into customer assignment protection', async () => {
    const service = { update: jest.fn().mockResolvedValue({ ok: true }) };
    const accessScope = { assertCustomer: jest.fn().mockResolvedValue(undefined) };
    const scopedController = new CustomersController(service as any, accessScope as any);
    const user = { id: 'admin-1', role: 'SUPER_ADMIN' };

    await expect(scopedController.update(
      'customer-1',
      { assignedStaffId: 'staff-1' } as any,
      { user },
    )).resolves.toEqual({ ok: true });

    expect(accessScope.assertCustomer).toHaveBeenCalledWith(user, 'customer-1');
    expect(service.update).toHaveBeenCalledWith(
      'customer-1',
      { assignedStaffId: 'staff-1' },
      user,
    );
  });

});