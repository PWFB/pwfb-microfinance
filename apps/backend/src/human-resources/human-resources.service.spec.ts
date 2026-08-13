import { HumanResourcesService } from './human-resources.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HumanResourcesService', () => {
  let service: HumanResourcesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      staff: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      department: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      branch: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new HumanResourcesService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return HR dashboard statistics', async () => {
    prisma.staff.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3);

    prisma.department.count.mockResolvedValue(4);
    prisma.branch.count.mockResolvedValue(2);

    await expect(service.dashboard()).resolves.toEqual({
      totalStaff: 10,
      activeStaff: 7,
      inactiveStaff: 3,
      departments: 4,
      branches: 2,
    });
  });

  it('should return employees', async () => {
    const result = [{ id: 'staff-1' }];
    prisma.staff.findMany.mockResolvedValue(result);

    await expect(service.employees()).resolves.toBe(result);
  });

  it('should return employee by id', async () => {
    const result = { id: 'staff-1' };
    prisma.staff.findUnique.mockResolvedValue(result);

    await expect(service.employee('staff-1')).resolves.toBe(result);
  });

  it('should throw when employee does not exist', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);

    await expect(
      service.employee('missing'),
    ).rejects.toThrow('Employee not found');
  });

  it('should return departments', async () => {
    const result = [{ id: 'dept-1' }];
    prisma.department.findMany.mockResolvedValue(result);

    await expect(service.departments()).resolves.toBe(result);
  });

  it('should return branches', async () => {
    const result = [{ id: 'branch-1' }];
    prisma.branch.findMany.mockResolvedValue(result);

    await expect(service.branches()).resolves.toBe(result);
  });

  it('should return active employees', async () => {
    const result = [{ id: 'staff-1' }];
    prisma.staff.findMany.mockResolvedValue(result);

    await expect(service.activeEmployees()).resolves.toBe(result);

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { employmentStatus: 'ACTIVE' },
      }),
    );
  });
});
