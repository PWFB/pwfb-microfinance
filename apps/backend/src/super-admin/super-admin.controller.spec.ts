import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';

describe('SuperAdminController', () => {
  let controller: SuperAdminController;
  let service: jest.Mocked<SuperAdminService>;

  beforeEach(() => {
    service = {
      dashboard: jest.fn(),
      systemStats: jest.fn(),
      financialStats: jest.fn(),
      staffStats: jest.fn(),
    } as unknown as jest.Mocked<SuperAdminService>;

    controller = new SuperAdminController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    const result = { system: {}, finance: {} };
    service.dashboard.mockResolvedValue(result as any);

    await expect(controller.dashboard()).resolves.toBe(result);
  });

  it('should return system stats', async () => {
    const result = { users: 10 };
    service.systemStats.mockResolvedValue(result);
    await expect(controller.systemStats()).resolves.toBe(result);
  });

  it('should return financial stats', async () => {
    const result = { totalSavings: 50000 };
    service.financialStats.mockResolvedValue(result);
    await expect(controller.financialStats()).resolves.toBe(result);
  });

  it('should return staff stats', async () => {
    const result = { total: 10, active: 8, inactive: 2 };
    service.staffStats.mockResolvedValue(result);
    await expect(controller.staffStats()).resolves.toBe(result);
  });
});
