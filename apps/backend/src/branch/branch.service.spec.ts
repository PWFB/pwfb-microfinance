import { NotFoundException } from '@nestjs/common';
import { BranchService } from './branch.service';

describe('BranchService', () => {
  let service: BranchService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      branch: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      branchVirtualAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      bankInstitution: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    service = new BranchService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a branch and return the persisted record', async () => {
    const dto = { name: 'Main Branch', address: 'Ibadan' };
    const branch = { id: 'branch-1', ...dto, branchAccounts: [], area: null, customers: [], staff: [] };
    prisma.branch.create.mockResolvedValue({ id: 'branch-1', ...dto });
    prisma.branch.findUnique.mockResolvedValue(branch);

    await expect(service.create(dto as any)).resolves.toEqual(branch);
    expect(prisma.branch.create).toHaveBeenCalledWith({ data: dto });
    expect(prisma.branch.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'branch-1' },
    }));
  });

  it('should return branches newest first with their account institutions', async () => {
    const branches = [{ id: 'branch-1', name: 'Main Branch', branchAccounts: [] }];
    prisma.branch.findMany.mockResolvedValue(branches);

    await expect(service.findAll()).resolves.toBe(branches);
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: { branchAccounts: { include: { institution: true } } },
    });
  });

  it('should throw when a branch does not exist', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update an existing branch', async () => {
    const branch = { id: 'branch-1', name: 'Old Name', branchAccounts: [], area: null, customers: [], staff: [] };
    const updated = { ...branch, name: 'New Name' };
    prisma.branch.findUnique.mockResolvedValue(branch);
    prisma.branch.update.mockResolvedValue(updated);

    await expect(service.update('branch-1', { name: 'New Name' } as any)).resolves.toBe(updated);
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
      data: { name: 'New Name' },
      include: { branchAccounts: { include: { institution: true } } },
    });
  });

  it('should delete an existing branch', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', name: 'Main Branch', branchAccounts: [], area: null, customers: [], staff: [] });
    prisma.branch.delete.mockResolvedValue({ id: 'branch-1' });

    await expect(service.remove('branch-1')).resolves.toEqual({ message: 'Branch deleted successfully' });
    expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 'branch-1' } });
  });

  it('should report when branches need virtual-account provisioning', async () => {
    prisma.branch.findMany.mockResolvedValue([
      { id: 'branch-1', name: 'Main Branch', branchAccounts: [] },
    ]);
    await expect(service.provisionVirtualAccounts()).resolves.toEqual({
      totalBranches: 1,
      provisioned: [{
        branchId: 'branch-1',
        branchName: 'Main Branch',
        virtualAccount: null,
        requiresPaystackProvisioning: true,
      }],
    });
  });
});
