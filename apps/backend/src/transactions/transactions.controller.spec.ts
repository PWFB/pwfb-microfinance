import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: any;
  const req = { user: { id: 'admin-1', role: 'ADMIN' }, headers: { authorization: 'Bearer test-token' } };

  beforeEach(() => {
    service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new TransactionsController(
      service as TransactionsService,
      { assertCustomer: jest.fn().mockResolvedValue(true) } as any,
      { assertVerified: jest.fn().mockResolvedValue(true) } as any,
    );
  });

  it('creates transaction after customer scope and MFA checks', async () => {
    const dto = { customerId: 'customer-1', type: 'DEPOSIT', amount: 5000 };
    const result = { id: 'transaction-1', ...dto };
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto as any, req as any)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('returns scoped transactions', async () => {
    const result = [{ id: 'transaction-1' }];
    service.findAll.mockResolvedValue(result);
    await expect(controller.findAll(req as any)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalledWith(req.user);
  });

  it('returns one scoped transaction', async () => {
    const result = { id: 'transaction-1' };
    service.findOne.mockResolvedValue(result);
    await expect(controller.findOne('transaction-1', req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('transaction-1', req.user);
  });

  it('updates an authorized transaction', async () => {
    const result = { id: 'transaction-1', amount: 7500 };
    service.findOne.mockResolvedValue(result);
    service.update.mockResolvedValue(result);
    await expect(controller.update('transaction-1', { amount: 7500 } as any, req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('transaction-1', req.user);
  });

  it('removes an authorized transaction', async () => {
    const result = { id: 'transaction-1' };
    service.findOne.mockResolvedValue(result);
    service.remove.mockResolvedValue(result);
    await expect(controller.remove('transaction-1', req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('transaction-1', req.user);
  });
});
