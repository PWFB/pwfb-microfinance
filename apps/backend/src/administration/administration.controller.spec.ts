import { AdministrationController } from './administration.controller';
import { AdministrationService } from './administration.service';

describe('AdministrationController', () => {
  let controller: AdministrationController;
  let service: jest.Mocked<AdministrationService>;

  beforeEach(() => {
    service = {
      overview: jest.fn(),
      getUsers: jest.fn(),
      getStaff: jest.fn(),
      getDepartments: jest.fn(),
      getDepartment: jest.fn(),
      getBranches: jest.fn(),
      getBranch: jest.fn(),
    } as unknown as jest.Mocked<AdministrationService>;

    controller = new AdministrationController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return overview', async () => {
    const result = {
      users: 10,
      staff: 8,
      departments: 4,
      branches: 3,
    };

    service.overview.mockResolvedValue(result);

    await expect(controller.overview()).resolves.toBe(result);
    expect(service.overview).toHaveBeenCalled();
  });

  it('should return users', async () => {
    const result = [{ id: 'user-1' }];

    service.getUsers.mockResolvedValue(result as any);

    await expect(controller.users()).resolves.toBe(result);
    expect(service.getUsers).toHaveBeenCalled();
  });

  it('should return staff', async () => {
    const result = [{ id: 'staff-1' }];

    service.getStaff.mockResolvedValue(result as any);

    await expect(controller.staff()).resolves.toBe(result);
    expect(service.getStaff).toHaveBeenCalled();
  });

  it('should return departments', async () => {
    const result = [{ id: 'dept-1' }];

    service.getDepartments.mockResolvedValue(result as any);

    await expect(controller.departments()).resolves.toBe(result);
    expect(service.getDepartments).toHaveBeenCalled();
  });

  it('should return one department', async () => {
    const result = { id: 'dept-1' };

    service.getDepartment.mockResolvedValue(result as any);

    await expect(
      controller.department('dept-1'),
    ).resolves.toBe(result);

    expect(service.getDepartment).toHaveBeenCalledWith(
      'dept-1',
    );
  });

  it('should return branches', async () => {
    const result = [{ id: 'branch-1' }];

    service.getBranches.mockResolvedValue(result as any);

    await expect(controller.branches()).resolves.toBe(result);
    expect(service.getBranches).toHaveBeenCalled();
  });

  it('should return one branch', async () => {
    const result = { id: 'branch-1' };

    service.getBranch.mockResolvedValue(result as any);

    await expect(
      controller.branch('branch-1'),
    ).resolves.toBe(result);

    expect(service.getBranch).toHaveBeenCalledWith(
      'branch-1',
    );
  });
});
