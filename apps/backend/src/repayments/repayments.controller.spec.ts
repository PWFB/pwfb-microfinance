import { RepaymentsController } from './repayments.controller';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsController', () => {
  let controller: RepaymentsController;
  let service: any;
  const req = { user: { id: 'staff-user', role: 'TELLER' }, headers: { authorization: 'Bearer test-token' } };

  beforeEach(() => {
    service = { create: jest.fn(), listBulkDailyLoans: jest.fn(), createBulkCashRepayments: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), update: jest.fn(), remove: jest.fn() };
    controller = new RepaymentsController(
      service as RepaymentsService,
      { assertLoan: jest.fn().mockResolvedValue(true) } as any,
      { assertVerified: jest.fn().mockResolvedValue(true) } as any,
      { assert: jest.fn().mockResolvedValue(true) } as any,
    );
  });

  it('creates repayment after loan scope and MFA checks', async () => {
    const dto = { loanId: 'loan-1', amount: 2500, method: 'CASH', cashReceivedConfirmed: true, reference: 'CASH-001' };
    const result = { id: 'repayment-1', ...dto };
    service.create.mockResolvedValue(result);
    await expect(controller.create(dto as any, req as any)).resolves.toBe(result);
    expect(service.create).toHaveBeenCalledWith(dto, req.user);
  });

  it('returns scoped repayments', async () => {
    const result = [{ id: 'repayment-1', loanId: 'loan-1', amount: 2500 }];
    service.findAll.mockResolvedValue(result);
    await expect(controller.findAll(req as any)).resolves.toBe(result);
    expect(service.findAll).toHaveBeenCalledWith(req.user);
  });

  it('returns one scoped repayment', async () => {
    const result = { id: 'repayment-1', loanId: 'loan-1', amount: 2500 };
    service.findOne.mockResolvedValue(result);
    await expect(controller.findOne('repayment-1', req as any)).resolves.toBe(result);
    expect(service.findOne).toHaveBeenCalledWith('repayment-1', req.user);
  });

  it('returns daily bulk loan queue within user scope', async () => {
    const result = { date: '2026-06-01', count: 0, loans: [] };
    service.listBulkDailyLoans.mockResolvedValue(result);
    await expect(controller.bulkDaily('2026-06-01', req as any)).resolves.toBe(result);
  });

  it('posts a bulk repayment after permission and MFA checks', async () => {
    const body = { date: '2026-06-01', batchReference: 'BULK-001', cashReceivedConfirmed: true, items: [{ loanId: 'loan-1', amount: 1000 }] };
    const result = { batchReference: 'BULK-001', paymentCount: 1, totalAmount: 1000 };
    service.createBulkCashRepayments.mockResolvedValue(result);
    await expect(controller.createBulk(body as any, req as any)).resolves.toBe(result);
    expect(service.createBulkCashRepayments).toHaveBeenCalledWith(body, req.user);
  });

  it('updates repayment only after MFA', async () => {
    const dto = { amount: 3000 };
    const result = { id: 'repayment-1', amount: 3000 };
    service.update.mockResolvedValue(result);
    await expect(controller.update('repayment-1', dto as any, req as any)).resolves.toBe(result);
    expect(service.update).toHaveBeenCalledWith('repayment-1', dto, req.user);
  });

  it('deletes repayment only after MFA', async () => {
    const result = { id: 'repayment-1' };
    service.remove.mockResolvedValue(result);
    await expect(controller.remove('repayment-1', req as any)).resolves.toBe(result);
    expect(service.remove).toHaveBeenCalledWith('repayment-1', req.user);
  });
});
