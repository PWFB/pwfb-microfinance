import { NotFoundException } from '@nestjs/common';
import { AdministrationService } from './administration.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AdministrationService', () => {
  let service: AdministrationService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    prisma = {
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      staff: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      department: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      branch: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    service = new AdministrationService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return administration overview counts', async () => {
    prisma.user.count.mockResolvedValue(10);
    prisma.staff.count.mockResolvedValue(8);
    prisma.department.count.mockResolvedValue(4);
    prisma.branch.count.mockResolvedValue(3);

    await expect(service.overview()).resolves.toEqual({
      users: 10,
      staff: 8,
      departments: 4,
      branches: 3,
    });

    expect(prisma.user.count).toHaveBeenCalled();
    expect(prisma.staff.count).toHaveBeenCalled();
    expect(prisma.department.count).toHaveBeenCalled();
    expect(prisma.branch.count).toHaveBeenCalled();
  });

  it('should return departments ordered by name', async () => {
    const result = [
      {
        id: 'dept-1',
        name: 'Administration',
        _count: { staff: 3 },
      },
    ];

    prisma.department.findMany.mockResolvedValue(result as any);

    await expect(service.getDepartments()).resolves.toBe(result);

    expect(prisma.department.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  });

  it('should return branches ordered by name', async () => {
    const result = [
      {
        id: 'branch-1',
        name: 'Main Branch',
        _count: { staff: 5 },
      },
    ];

    prisma.branch.findMany.mockResolvedValue(result as any);

    await expect(service.getBranches()).resolves.toBe(result);

    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            staff: true,
          },
        },
      },
    });
  });

  it('should return staff with department and branch', async () => {
    const result = [
      {
        id: 'staff-1',
        department: { id: 'dept-1', name: 'Loans' },
        branch: { id: 'branch-1', name: 'Main Branch' },
      },
    ];

    prisma.staff.findMany.mockResolvedValue(result as any);

    await expect(service.getStaff()).resolves.toBe(result);

    expect(prisma.staff.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: {
        department: true,
        branch: true,
      },
    });
  });

  it('should return users without passwords', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        email: 'admin@pwfb.com',
        password: 'secret',
        role: 'ADMIN',
      },
    ] as any);

    await expect(service.getUsers()).resolves.toEqual([
      {
        id: 'user-1',
        email: 'admin@pwfb.com',
        role: 'ADMIN',
      },
    ]);
  });

  it('should return a department with staff', async () => {
    const result = {
      id: 'dept-1',
      name: 'Loans',
      staff: [],
    };

    prisma.department.findUnique.mockResolvedValue(result as any);

    await expect(
      service.getDepartment('dept-1'),
    ).resolves.toBe(result);

    expect(prisma.department.findUnique).toHaveBeenCalledWith({
      where: { id: 'dept-1' },
      include: { staff: true },
    });
  });

  it('should throw when department does not exist', async () => {
    prisma.department.findUnique.mockResolvedValue(null);

    await expect(
      service.getDepartment('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should return a branch with staff', async () => {
    const result = {
      id: 'branch-1',
      name: 'Main Branch',
      staff: [],
    };

    prisma.branch.findUnique.mockResolvedValue(result as any);

    await expect(
      service.getBranch('branch-1'),
    ).resolves.toBe(result);

    expect(prisma.branch.findUnique).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
      include: { staff: true },
    });
  });

  it('should throw when branch does not exist', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);

    await expect(
      service.getBranch('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
