import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';
import { StaffWalletService } from '../staff-wallet/staff-wallet.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('CollectionsService', () => {
  let service: CollectionsService;
  const prisma = {
    dailyCollection: {
      findMany: jest.fn(),
    },
  } as any;
  const accessScope = {
    getScope: jest.fn(),
    getScopedBranchIds: jest.fn(),
    assertBranch: jest.fn(),
    assertStaff: jest.fn(),
    assertCustomer: jest.fn(),
    assertCollection: jest.fn(),
  } as any;
  const user = { id: 'co-user', role: 'CREDIT_OFFICER', staffId: 'staff-1' };

  beforeEach(async () => {
    jest.clearAllMocks();
    accessScope.getScope.mockResolvedValue({ global: false, role: 'CREDIT_OFFICER', staffId: 'staff-1' });
    accessScope.getScopedBranchIds.mockResolvedValue(['branch-1']);
    prisma.dailyCollection.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StaffWalletService, useValue: {} },
        { provide: AccessScopeService, useValue: accessScope },
      ],
    }).compile();
    service = module.get<CollectionsService>(CollectionsService);
  });

  it('is defined', () => expect(service).toBeDefined());

  it('limits collection lists and summaries to the signed-in officer Staff ID and branch', async () => {
    await service.findAll(user);
    expect(prisma.dailyCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: { in: ['branch-1'] }, staffId: 'staff-1' },
    }));

    prisma.dailyCollection.findMany.mockClear();
    await service.summary(user);
    expect(prisma.dailyCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: { in: ['branch-1'] }, staffId: 'staff-1' },
    }));
  });

  it('limits daily summary aggregation to the signed-in officer branch and Staff ID', async () => {
    await service.dailySummary(user, '2026-11-09');
    expect(prisma.dailyCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        branchId: { in: ['branch-1'] },
        staffId: 'staff-1',
        collectionDate: { gte: expect.any(Date), lte: expect.any(Date) },
      }),
    }));
  });

  it('rejects another officer Staff ID as a list filter', async () => {
    await expect(service.findAll(user, undefined, undefined, 'staff-2')).rejects.toThrow('You can only access collection records linked to your Staff ID');
  });

  it('allows a Super Admin to query a requested branch explicitly', async () => {
    accessScope.getScope.mockResolvedValue({ global: true, role: 'SUPER_ADMIN', staffId: null });
    await service.findAll({ id: 'root', role: 'SUPER_ADMIN' }, undefined, 'branch-9');
    expect(prisma.dailyCollection.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { branchId: 'branch-9' },
    }));
  });
});
