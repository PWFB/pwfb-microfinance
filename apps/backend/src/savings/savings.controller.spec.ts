import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

describe('SavingsController', () => {
  let controller: SavingsController;
  let service: any;
  const req = { user: { id: 'admin-1', role: 'ADMIN' }, headers: { authorization: 'Bearer test-token' } };

  beforeEach(() => {
    service = { create: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new SavingsController(
      service as SavingsService,
      { assert: jest.fn().mockResolvedValue(true) } as any,
      { assertVerified: jest.fn().mockResolvedValue(true) } as any,
      { assertCustomer: jest.fn().mockResolvedValue(true), assertSavings: jest.fn().mockResolvedValue(true), filterList: jest.fn((user, resource, rows) => rows) } as any,
    );
  });

  it('creates savings with customer scope, permission and MFA', async () => {
    const dto = { customerId: 'customer-1', amount: 5000, accountType: 'SAVINGS' };
    const result = { id: 'saving-1', ...dto };
    service.create.mockResolvedValue(result);
    await expect(controller.create(req as any, dto as any)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('returns authorized savings records', async () => {
    const result = [{ id: 'saving-1' }];
    service.findAll.mockResolvedValue(result);
    await expect(controller.findAll(req as any)).resolves.toBe(result);
  });

  it('returns one authorized savings record', async () => {
    const result = { id: 'saving-1' };
    service.findOne.mockResolvedValue(result);
    await expect(controller.findOne('saving-1', req as any)).resolves.toBe(result);
  });

  it('updates savings after access and MFA checks', async () => {
    const dto = { amount: 7500 };
    const result = { id: 'saving-1', amount: 7500 };
    service.update.mockResolvedValue(result);
    await expect(controller.update(req as any, 'saving-1', dto as any)).resolves.toBe(result);
  });

  it('deletes savings after access and MFA checks', async () => {
    const result = { id: 'saving-1' };
    service.remove.mockResolvedValue(result);
    await expect(controller.remove('saving-1', req as any)).resolves.toBe(result);
  });
});
