import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

describe('LoansController', () => {
  let controller: LoansController;
  let service: any;
  const req = { user: { id: 'admin-1', role: 'ADMIN' }, headers: { authorization: 'Bearer test-token' } };

  beforeEach(() => {
    service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new LoansController(
      service as LoansService,
      {} as any,
      {} as any,
      { assert: jest.fn().mockResolvedValue(true) } as any,
      { assertVerified: jest.fn().mockResolvedValue(true) } as any,
      { assertCustomer: jest.fn().mockResolvedValue(true) } as any,
    );
  });

  it('creates a loan after role permission check', async () => {
    const dto = { customerId: 'customer-1', amount: 100000, interestRate: 10 };
    const result = { id: 'loan-1', ...dto };
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto as any, req)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto, req.user);
  });

  it('returns scoped loans', async () => {
    const result = [{ id: 'loan-1' }];
    service.findAll.mockResolvedValue(result);
    await expect(controller.findAll(req as any)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalledWith(req.user);
  });

  it('returns one scoped loan', async () => {
    const result = { id: 'loan-1' };
    service.findOne.mockResolvedValue(result);
    await expect(controller.findOne('loan-1', req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('loan-1', req.user);
  });

  it('updates a loan after MFA', async () => {
    const dto = { amount: 125000 };
    const result = { id: 'loan-1', ...dto };
    service.update.mockResolvedValue(result);
    await expect(controller.update('loan-1', dto as any, req as any)).resolves.toBe(result);
    expect(service.update).toHaveBeenCalledWith('loan-1', dto, req.user);
  });

  it('removes a loan after MFA', async () => {
    const result = { id: 'loan-1' };
    service.remove.mockResolvedValue(result);
    await expect(controller.remove('loan-1', req as any)).resolves.toBe(result);
    expect(service.remove).toHaveBeenCalledWith('loan-1', req.user);
  });
});
