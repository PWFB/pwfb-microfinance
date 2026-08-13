import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: jest.Mocked<ReportsService>;

  beforeEach(() => {
    service = {
      getSummary: jest.fn(),
    } as unknown as jest.Mocked<ReportsService>;

    controller = new ReportsController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return report summary', async () => {
    const result = {
      customers: { count: 10 },
      savings: { count: 5, amount: 50000 },
    };

    service.getSummary.mockResolvedValue(result as any);

    await expect(controller.getSummary()).resolves.toBe(result);
    expect(service.getSummary).toHaveBeenCalled();
  });
});
