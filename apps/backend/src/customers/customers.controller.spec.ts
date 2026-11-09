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
          useValue: {},
        },
        { provide: AccessScopeService, useValue: { assertCustomer: jest.fn().mockResolvedValue(undefined) }
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
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