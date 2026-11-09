import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { PermissionsService } from '../permissions/permissions.service';

describe('SavingsController', () => {
  let controller: SavingsController;
  let service: jest.Mocked<SavingsService>;
  let accessScope: any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<SavingsService>;

    accessScope = { assertCustomer: jest.fn().mockResolvedValue(undefined) };
    controller = new SavingsController(service, { assert: jest.fn().mockResolvedValue(undefined) } as unknown as PermissionsService, accessScope);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create savings', async () => {
    const dto = {
      customerId: 'customer-1',
      amount: 5000,
      accountType: 'SAVINGS',
    };

    const result = { id: 'saving-1', ...dto };

    service.create.mockResolvedValue(result as any);

    await expect(controller.create({ user: { role: 'ADMIN' } } as any, dto)).resolves.toBe(result);
    expect(accessScope.assertCustomer).toHaveBeenCalledWith({ role: 'ADMIN' }, 'customer-1');
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all savings', async () => {
    const result = [
      {
        id: 'saving-1',
        customerId: 'customer-1',
        amount: 5000,
      },
    ];

    service.findAll.mockResolvedValue(result as any);

    await expect(controller.findAll()).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one savings record', async () => {
    const result = {
      id: 'saving-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    service.findOne.mockResolvedValue(result as any);

    await expect(controller.findOne('saving-1')).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('saving-1');
  });

  it('should update savings', async () => {
    const dto = {
      amount: 7500,
      customerId: 'customer-2',
    };

    const result = {
      id: 'saving-1',
      customerId: 'customer-1',
      amount: 7500,
    };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update({ user: { role: 'ADMIN' } } as any, 'saving-1', dto),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      'saving-1',
      dto,
    );
    expect(accessScope.assertCustomer).toHaveBeenCalledWith({ role: 'ADMIN' }, 'customer-2');
  });

  it('should delete savings', async () => {
    const result = {
      id: 'saving-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    service.remove.mockResolvedValue(result as any);

    await expect(controller.remove('saving-1')).resolves.toBe(result);
    expect(service.remove).toHaveBeenCalledWith('saving-1');
  });
});
