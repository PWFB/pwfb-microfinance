import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionsService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<TransactionsService>;

    controller = new TransactionsController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create transaction', async () => {
    const dto = {
      customerId: 'customer-1',
      type: 'DEPOSIT',
      amount: 5000,
    };

    const result = {
      id: 'transaction-1',
      ...dto,
    };

    service.create.mockResolvedValue(result as any);

    await expect(
      controller.create(dto),
    ).resolves.toBe(result);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all transactions', async () => {
    const result = [
      {
        id: 'transaction-1',
        customerId: 'customer-1',
        amount: 5000,
      },
    ];

    service.findAll.mockResolvedValue(result as any);

    await expect(
      controller.findAll(),
    ).resolves.toBe(result);

    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one transaction', async () => {
    const result = {
      id: 'transaction-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    service.findOne.mockResolvedValue(result as any);

    await expect(
      controller.findOne('transaction-1'),
    ).resolves.toBe(result);

    expect(service.findOne).toHaveBeenCalledWith(
      'transaction-1',
    );
  });

  it('should update transaction', async () => {
    const dto = {
      amount: 7500,
    };

    const result = {
      id: 'transaction-1',
      amount: 7500,
    };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('transaction-1', dto),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      'transaction-1',
      dto,
    );
  });

  it('should delete transaction', async () => {
    const result = {
      id: 'transaction-1',
    };

    service.remove.mockResolvedValue(result as any);

    await expect(
      controller.remove('transaction-1'),
    ).resolves.toBe(result);

    expect(service.remove).toHaveBeenCalledWith(
      'transaction-1',
    );
  });
});
