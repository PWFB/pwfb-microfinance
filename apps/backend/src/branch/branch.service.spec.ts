import { BranchService } from './branch.service';

describe('BranchService', () => {
  let service: BranchService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      branch: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      branchVirtualAccount: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      bankInstitution: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new BranchService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a branch and return the persisted branch', async () => {
    const branch = { id: 'branch-1', name: 'Main Branch', code: 'MAIN' };
    prisma.branch.create.mockResolvedValue(branch);
    prisma.branch.findUnique.mockResolvedValue(branch);

    await expect(service.create({ name: 'Main Branch', code: 'MAIN' } as any))
      .resolves.toEqual(branch);
    expect(prisma.branch.create).toHaveBeenCalledWith({
      data: { name: 'Main Branch', code: 'MAIN' },
    });
  });

  it('should return all branches from Prisma', async () => {
    const branches = [{ id: 'branch-1', name: 'Main Branch' }];
    prisma.branch.findMany.mockResolvedValue(branches);

    await expect(service.findAll()).resolves.toBe(branches);
    expect(prisma.branch.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      include: { branchAccounts: { include: { institution: true } } },
    });
  });

  it('should return a branch by id', async () => {
    const branch = { id: 'branch-1', name: 'Main Branch' };
    prisma.branch.findUnique.mockResolvedValue(branch);

    await expect(service.findOne('branch-1')).resolves.toBe(branch);
  });

  it('should throw not found for a missing branch', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow('Branch not found');
  });

  it('should update an existing branch', async () => {
    const existing = { id: 'branch-1', name: 'Main Branch' };
    const updated = { id: 'branch-1', name: 'Updated Main Branch' };
    prisma.branch.findUnique.mockResolvedValue(existing);
    prisma.branch.update.mockResolvedValue(updated);

    await expect(service.update('branch-1', { name: 'Updated Main Branch' } as any))
      .resolves.toBe(updated);
    expect(prisma.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-1' },
      data: { name: 'Updated Main Branch' },
      include: { branchAccounts: { include: { institution: true } } },
    });
  });

  it('should not update a missing branch', async () => {
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(service.update('missing', { name: 'Missing Branch' } as any))
      .rejects.toThrow('Branch not found');
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });

  it('should delete an existing branch', async () => {
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1', name: 'Main Branch' });
    prisma.branch.delete.mockResolvedValue({ id: 'branch-1' });

    await expect(service.remove('branch-1')).resolves.toEqual({
      message: 'Branch deleted successfully',
    });
    expect(prisma.branch.delete).toHaveBeenCalledWith({ where: { id: 'branch-1' } });
  });

  it('should report active virtual account provisioning status', async () => {
    prisma.branch.findMany.mockResolvedValue([
      { id: 'branch-1', name: 'Main Branch', branchAccounts: [
        { status: 'ACTIVE', accountNumber: '1234567890' },
      ] },
      { id: 'branch-2', name: 'Ikeja Branch', branchAccounts: [] },
    ]);

    await expect(service.provisionVirtualAccounts()).resolves.toEqual({
      totalBranches: 2,
      provisioned: [
        { branchId: 'branch-1', branchName: 'Main Branch', virtualAccount: { status: 'ACTIVE', accountNumber: '1234567890' }, requiresPaystackProvisioning: false },
        { branchId: 'branch-2', branchName: 'Ikeja Branch', virtualAccount: null, requiresPaystackProvisioning: true },
      ],
    });
  });
});
