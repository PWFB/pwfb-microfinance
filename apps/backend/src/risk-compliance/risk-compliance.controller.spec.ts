import { RiskComplianceController } from './risk-compliance.controller';
import { RiskComplianceService } from './risk-compliance.service';

describe('RiskComplianceController', () => {
  let controller: RiskComplianceController;
  let service: jest.Mocked<RiskComplianceService>;

  beforeEach(() => {
    service = {
      dashboard: jest.fn(),
      loanRisk: jest.fn(),
      operationalChecks: jest.fn(),
      staffRisk: jest.fn(),
    } as unknown as jest.Mocked<RiskComplianceService>;

    controller = new RiskComplianceController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    const result = { customers: 10 };
    service.dashboard.mockResolvedValue(result as any);
    await expect(controller.dashboard()).resolves.toBe(result);
  });

  it('should return loan risk', async () => {
    const result = { totalLoans: 4 };
    service.loanRisk.mockResolvedValue(result as any);
    await expect(controller.loanRisk()).resolves.toBe(result);
  });

  it('should return operational checks', async () => {
    const result = { customers: 10, checks: {} };
    service.operationalChecks.mockResolvedValue(result as any);
    await expect(controller.operationalChecks()).resolves.toBe(result);
  });

  it('should return staff risk', async () => {
    const result = { active: 5, inactive: 2, total: 7 };
    service.staffRisk.mockResolvedValue(result);
    await expect(controller.staffRisk()).resolves.toBe(result);
  });
});
