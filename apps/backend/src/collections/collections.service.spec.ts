import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';

describe('CollectionsService', () => {
  const prisma: any = {};
  const staffWallet: any = {};
  let service: CollectionsService;

  beforeEach(() => {
    service = new CollectionsService(prisma as PrismaService, staffWallet);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('moves an open collection from pending to reconciled', async () => {
    const collection = {
      id: 'collection-1',
      reconciled: false,
      settled: false,
      period: { status: 'OPEN' },
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(collection as any);
    prisma.dailyCollection = {
      update: jest.fn().mockResolvedValue({ ...collection, reconciled: true }),
    };

    const result = await service.reconcile('collection-1');

    expect(result.reconciled).toBe(true);
    expect(prisma.dailyCollection.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'collection-1' },
      data: { reconciled: true },
    }));
  });

  it('allows an open unreconciled collection to return to pending', async () => {
    const collection = {
      id: 'collection-2',
      reconciled: true,
      settled: false,
      period: { status: 'OPEN' },
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(collection as any);
    prisma.dailyCollection = {
      update: jest.fn().mockResolvedValue({ ...collection, reconciled: false }),
    };

    const result = await service.unreconcile('collection-2');

    expect(result.reconciled).toBe(false);
    expect(prisma.dailyCollection.update).toHaveBeenCalledWith({
      where: { id: 'collection-2' },
      data: { reconciled: false },
    });
  });

  it('rejects reconciliation changes after the financial period is closed', async () => {
    const collection = {
      id: 'collection-3',
      reconciled: false,
      settled: false,
      period: { status: 'CLOSED' },
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(collection as any);

    await expect(service.reconcile('collection-3'))
      .rejects.toThrow('Collection belongs to a closed period');

    await expect(service.unreconcile('collection-3'))
      .rejects.toThrow('Collection belongs to a closed period');
  });

  it('prevents a settled collection from being unreconciled', async () => {
    const collection = {
      id: 'collection-4',
      reconciled: true,
      settled: true,
      period: { status: 'OPEN' },
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(collection as any);

    await expect(service.unreconcile('collection-4'))
      .rejects.toThrow('A settled collection cannot be unreconciled');
  });
});
