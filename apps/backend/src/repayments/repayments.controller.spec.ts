import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsController', () => {
  let controller: RepaymentsController;
  let service: jest.Mocked<RepaymentsService>;
  let accessScope: any;
  const req = { user: { id: 'admin-user', role: 'SUPER_ADMIN' } } as any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<RepaymentsService>;

    accessScope = { assertLoan: jest.fn().mockResolvedValue(undefined), filterList: jest.fn((_user: any, _resource: string, rows: any[]) => rows) };
    controller = new RepaymentsController(service, accessScope);
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
      controller.create(dto, req),
    ).resolves.toBe(result);

    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all repayments', async () => {
    const result = [
      {
        id: 'repayment-1',
        loanId: 'loan-1',
        amount: 2500,
        loan: { id: 'loan-1' },
      },
    ];

    service.findAll.mockResolvedValue(result as any);

    await expect(
      controller.findAll(req),
    ).resolves.toBe(result);

    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one repayment', async () => {
    const result = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 2500,
      loan: { id: 'loan-1' },
    };

    service.findOne.mockResolvedValue(result as any);

    await expect(
      controller.findOne('repayment-1', req),
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
      loanId: 'loan-1',
      loan: { id: 'loan-1' },
    };
    service.findOne.mockResolvedValue({ id: 'repayment-1', loanId: 'loan-1', loan: { id: 'loan-1' } } as any);
    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('repayment-1', dto, req),
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
    service.findOne.mockResolvedValue({ id: 'repayment-1', loanId: 'loan-1', loan: { id: 'loan-1' } } as any);
    service.remove.mockResolvedValue(result as any);

    await expect(
      controller.remove('repayment-1', req),
    ).resolves.toBe(result);

    expect(service.remove).toHaveBeenCalledWith(
      'repayment-1',
    );
  });
});
