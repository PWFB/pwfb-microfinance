import { Test, TestingModule } from '@nestjs/testing';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('CashbookController', () => {
  let controller: CashbookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashbookController],
      providers: [
        {
          provide: CashbookService,
          useValue: {},
        },
        { provide: AccessScopeService, useValue: { getScope: jest.fn(), assertBranch: jest.fn(), filterList: jest.fn() }
        },
      ],
    }).compile();

    controller = module.get<CashbookController>(CashbookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('aggregates daily cashbook balances without double-counting carried-forward cash', async () => {
    const rows = [
      { id: 'a-1', branchId: 'branch-1', staffId: 'staff-1', entryDate: '2026-11-08T12:00:00.000Z', createdAt: '2026-11-08T13:00:00.000Z', previousCashAtHand: 100, savingsDeposits: 40, totalReceipts: 140, totalPayments: 20, otherAfterTotal: 120 },
      { id: 'a-2', branchId: 'branch-1', staffId: 'staff-1', entryDate: '2026-11-09T12:00:00.000Z', createdAt: '2026-11-09T13:00:00.000Z', previousCashAtHand: 120, savingsDeposits: 10, totalReceipts: 130, totalPayments: 30, otherAfterTotal: 100 },
      { id: 'b-1', branchId: 'branch-1', staffId: 'staff-2', entryDate: '2026-11-08T12:00:00.000Z', createdAt: '2026-11-08T13:30:00.000Z', previousCashAtHand: 50, savingsDeposits: 25, totalReceipts: 75, totalPayments: 5, otherAfterTotal: 70 },
      { id: 'b-2', branchId: 'branch-1', staffId: 'staff-2', entryDate: '2026-11-09T12:00:00.000Z', createdAt: '2026-11-09T13:30:00.000Z', previousCashAtHand: 70, savingsDeposits: 5, totalReceipts: 75, totalPayments: 10, otherAfterTotal: 65 },
    ];
    const cashbookService = { findDaily: jest.fn().mockResolvedValue(rows) };
    const accessScope = {
      getScope: jest.fn().mockResolvedValue({ global: false, role: 'BRANCH_MANAGER', branchId: 'branch-1' }),
      assertBranch: jest.fn(),
      filterList: jest.fn((_user: any, _resource: string, visibleRows: any[]) => visibleRows),
    };
    const scopedController = new CashbookController(cashbookService as any, accessScope as any);

    const result = await scopedController.dailySummary({ user: { id: 'manager-1', role: 'BRANCH_MANAGER' } });

    expect(result.records).toBe(4);
    expect(result.previousCashAtHand).toBe(150);
    expect(result.otherAfterTotal).toBe(165);
    expect(result.savingsDeposits).toBe(80);
    expect(result.totalReceipts).toBe(230);
    expect(result.totalPayments).toBe(65);
    expect(result.netAmount).toBe(165);
  });

  it('blocks Teller daily cashbook cash-out, withdrawal and transfer values', async () => {
    const cashbookService = { createDaily: jest.fn() };
    const accessScope = {
      getScope: jest.fn().mockResolvedValue({
        global: false,
        role: 'TELLER',
        staffId: 'teller-staff-1',
        branchId: 'branch-1',
      }),
      assertBranch: jest.fn(),
      filterList: jest.fn(),
    };
    const scopedController = new CashbookController(cashbookService as any, accessScope as any);

    await expect(scopedController.createDaily(
      {
        periodId: 'period-1',
        branchId: 'branch-1',
        dailyDisbursementAmount: 100,
      } as any,
      { user: { id: 'teller-user', role: 'TELLER' } },
    )).rejects.toThrow('Teller daily cashbook entries may record receipts only');

    expect(cashbookService.createDaily).not.toHaveBeenCalled();
  });

  it('allows Teller daily cashbook receipts with authenticated staff and branch attribution', async () => {
    const cashbookService = { createDaily: jest.fn().mockResolvedValue({ id: 'daily-1' }) };
    const accessScope = {
      getScope: jest.fn().mockResolvedValue({
        global: false,
        role: 'TELLER',
        staffId: 'teller-staff-1',
        branchId: 'branch-1',
      }),
      assertBranch: jest.fn(),
      filterList: jest.fn(),
    };
    const scopedController = new CashbookController(cashbookService as any, accessScope as any);

    await expect(scopedController.createDaily(
      {
        periodId: 'period-1',
        branchId: 'branch-1',
        dailyCollection: 250,
      } as any,
      { user: { id: 'teller-user', role: 'TELLER' } },
    )).resolves.toEqual({ id: 'daily-1' });

    expect(cashbookService.createDaily).toHaveBeenCalledWith(expect.objectContaining({
      branchId: 'branch-1',
      staffId: 'teller-staff-1',
      dailyCollection: 250,
    }));
  });

});