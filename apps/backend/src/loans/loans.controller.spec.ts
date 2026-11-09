import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { PermissionsService } from '../permissions/permissions.service';

describe('LoansController', () => {
  let controller: LoansController;
  let service: jest.Mocked<LoansService>;
  let accessScope: any;
  const req = { user: { id: 'admin-user', role: 'ADMIN' } } as any;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<LoansService>;

    accessScope = { assertCustomer: jest.fn().mockResolvedValue(undefined), assertLoan: jest.fn().mockResolvedValue(undefined), filterList: jest.fn((_user: any, _resource: string, rows: any[]) => rows) };
    controller = new LoansController(service, {} as any, {} as any, { assert: jest.fn().mockResolvedValue(undefined) } as unknown as PermissionsService, accessScope);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a loan', async () => {
    const dto = {
      customerId: 'customer-1',
      amount: 100000,
      interestRate: 10,
      status: 'PENDING',
    };

    const result = {
      id: 'loan-1',
      ...dto,
    };

    service.create.mockResolvedValue(result as any);

    await expect(controller.create(dto, { user: { role: 'ADMIN' } } as any)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('should return all loans', async () => {
    const result = [
      {
        id: 'loan-1',
        customerId: 'customer-1',
        amount: 100000,
      },
    ];

    service.findAll.mockResolvedValue(result as any);

    await expect(controller.findAll(req)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalled();
  });

  it('should return one loan', async () => {
    const result = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
    };

    service.findOne.mockResolvedValue(result as any);

    await expect(
      controller.findOne('loan-1', req),
    ).resolves.toBe(result);

    expect(service.findOne).toHaveBeenCalledWith('loan-1');
  });

  it('should update a loan', async () => {
    const dto = {
      amount: 125000,
      interestRate: 12,
    };

    const result = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 125000,
      interestRate: 12,
    };

    service.update.mockResolvedValue(result as any);

    await expect(
      controller.update('loan-1', dto, req),
    ).resolves.toBe(result);

    expect(service.update).toHaveBeenCalledWith(
      'loan-1',
      dto,
    );
  });

  it('should delete a loan', async () => {
    const result = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
    };

    service.remove.mockResolvedValue(result as any);

    await expect(
      controller.remove('loan-1', req),
    ).resolves.toBe(result);

    expect(service.remove).toHaveBeenCalledWith('loan-1');
  });
});
