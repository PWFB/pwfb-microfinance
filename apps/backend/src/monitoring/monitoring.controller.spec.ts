import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('MonitoringController', () => {
  let controller: MonitoringController;
  let service: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    service = {
      dashboard: jest.fn(),
      staffStatus: jest.fn(),
      loanStatuses: jest.fn(),
      recentTransactions: jest.fn(),
      departments: jest.fn(),
      branches: jest.fn(),
    } as unknown as jest.Mocked<MonitoringService>;

    controller = new MonitoringController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    const result = { customers: 10 };
    service.dashboard.mockResolvedValue(result as any);
    await expect(controller.dashboard()).resolves.toBe(result);
  });

  it('should return staff status', async () => {
    const result = { active: 5, inactive: 2, total: 7 };
    service.staffStatus.mockResolvedValue(result);
    await expect(controller.staffStatus()).resolves.toBe(result);
  });

  it('should return loan statuses', async () => {
    const result = { PENDING: 3, APPROVED: 2 };
    service.loanStatuses.mockResolvedValue(result);
    await expect(controller.loanStatuses()).resolves.toBe(result);
  });

  it('should return recent transactions', async () => {
    const result = [{ id: 'tx-1' }];
    service.recentTransactions.mockResolvedValue(result as any);
    await expect(controller.recentTransactions()).resolves.toBe(result);
  });

  it('should return departments', async () => {
    const result = [{ id: 'dept-1' }];
    service.departments.mockResolvedValue(result as any);
    await expect(controller.departments()).resolves.toBe(result);
  });

  it('should return branches', async () => {
    const result = [{ id: 'branch-1' }];
    service.branches.mockResolvedValue(result as any);
    await expect(controller.branches()).resolves.toBe(result);
  });
});
