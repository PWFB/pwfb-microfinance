import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsController', () => {
  let controller: RepaymentsController;
  let service: jest.Mocked<RepaymentsService>;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<RepaymentsService>;

    controller = new RepaymentsController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create repayment', async () => {
    const dto = {
      loanId: 'loan-1',
      amount: 2500,
      method: 'CASH',
    };

    const result = {
      id: 'repayment-1',
      ...dto,
    };

    service.create.mockResolvedValue(result as any);

    await expect(
      controller.create(dto),
    ).resolves.toBe(result);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all repayments', async () => {
    const result = [
      {
        id: 'repayment-1',
        loanId: 'loan-1',
        amount: 2500,
      },
    ];

    service.findAll.mockResolvedValue(result as any);

    await expect(
      controller.findAll(),
    ).resolves.toBe(result);

    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one repayment', async () => {
    const result = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 2500,
    };

    service.findOne.mockResolvedValue(result as any);

    await expect(
      controller.findOne('repayment-1'),
    ).resolves.toBe(result);

    expect(service.findOne).toHaveBeenCalledWith(
      'repayment-1',
    );
  });

  it('should update repayment', async () => {
    const dto = {
      amount: 3000,
    };

    const result = {
      id: 'repayment-1',
      amount: 3000,
    };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('repayment-1', dto),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      'repayment-1',
      dto,
    );
  });

  it('should delete repayment', async () => {
    const result = {
      id: 'repayment-1',
    };

    service.remove.mockResolvedValue(result as any);

    await expect(
      controller.remove('repayment-1'),
    ).resolves.toBe(result);

    expect(service.remove).toHaveBeenCalledWith(
      'repayment-1',
    );
  });
});
