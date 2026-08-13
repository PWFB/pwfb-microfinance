import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

describe('SavingsController', () => {
  let controller: SavingsController;
  let service: jest.Mocked<SavingsService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<SavingsService>;

    controller = new SavingsController(service);
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

    await expect(controller.create(dto)).resolves.toBe(result);
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
    };

    const result = {
      id: 'saving-1',
      customerId: 'customer-1',
      amount: 7500,
    };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('saving-1', dto),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      'saving-1',
      dto,
    );
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
