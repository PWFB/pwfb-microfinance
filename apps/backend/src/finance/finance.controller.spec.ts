import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

describe('FinanceController', () => {
  let controller: FinanceController;
  let service: jest.Mocked<FinanceService>;

  beforeEach(() => {
    service = {
      dashboard: jest.fn(),
      savingsSummary: jest.fn(),
      loansSummary: jest.fn(),
      repaymentsSummary: jest.fn(),
      recentTransactions: jest.fn(),
    } as unknown as jest.Mocked<FinanceService>;

    controller = new FinanceController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    const result = {
      totalSavings: 100000,
      totalLoans: 60000,
      totalRepayments: 25000,
      outstandingLoans: 35000,
    };

    service.dashboard.mockResolvedValue(result as any);

    await expect(controller.dashboard()).resolves.toBe(result);
    expect(service.dashboard).toHaveBeenCalled();
  });

  it('should return savings summary', async () => {
    const result = { total: 100000, accounts: 20 };

    service.savingsSummary.mockResolvedValue(result);

    await expect(controller.savings()).resolves.toBe(result);
    expect(service.savingsSummary).toHaveBeenCalled();
  });

  it('should return loans summary', async () => {
    const result = { total: 60000, loans: 10 };

    service.loansSummary.mockResolvedValue(result);

    await expect(controller.loans()).resolves.toBe(result);
    expect(service.loansSummary).toHaveBeenCalled();
  });

  it('should return repayments summary', async () => {
    const result = { total: 25000, repayments: 15 };

    service.repaymentsSummary.mockResolvedValue(result);

    await expect(
      controller.repayments(),
    ).resolves.toBe(result);

    expect(service.repaymentsSummary).toHaveBeenCalled();
  });

  it('should return recent transactions', async () => {
    const result = [{ id: 'tx-1' }];

    service.recentTransactions.mockResolvedValue(result as any);

    await expect(
      controller.recentTransactions(),
    ).resolves.toBe(result);

    expect(service.recentTransactions).toHaveBeenCalled();
  });
});
