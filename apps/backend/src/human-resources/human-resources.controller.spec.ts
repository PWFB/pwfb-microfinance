import { HumanResourcesController } from './human-resources.controller';
import { HumanResourcesService } from './human-resources.service';

describe('HumanResourcesController', () => {
  let controller: HumanResourcesController;
  let service: jest.Mocked<HumanResourcesService>;

  beforeEach(() => {
    service = {
      dashboard: jest.fn(),
      employees: jest.fn(),
      activeEmployees: jest.fn(),
      employee: jest.fn(),
      departments: jest.fn(),
      branches: jest.fn(),
    } as unknown as jest.Mocked<HumanResourcesService>;

    controller = new HumanResourcesController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return dashboard', async () => {
    const result = { totalStaff: 10 };
    service.dashboard.mockResolvedValue(result as any);
    await expect(controller.dashboard()).resolves.toBe(result);
    expect(service.dashboard).toHaveBeenCalled();
  });

  it('should return employees', async () => {
    const result = [{ id: 'staff-1' }];
    service.employees.mockResolvedValue(result as any);
    await expect(controller.employees()).resolves.toBe(result);
  });

  it('should return active employees', async () => {
    const result = [{ id: 'staff-1' }];
    service.activeEmployees.mockResolvedValue(result as any);
    await expect(controller.activeEmployees()).resolves.toBe(result);
  });

  it('should return one employee', async () => {
    const result = { id: 'staff-1' };
    service.employee.mockResolvedValue(result as any);
    await expect(controller.employee('staff-1')).resolves.toBe(result);
    expect(service.employee).toHaveBeenCalledWith('staff-1');
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
