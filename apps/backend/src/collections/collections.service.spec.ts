import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionsService } from './collections.service';
import { StaffWalletService } from '../staff-wallet/staff-wallet.service';
import { BadRequestException } from '@nestjs/common';

describe('CollectionsService', () => {
  let service: CollectionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: PrismaService, useValue: {} },
        { provide: StaffWalletService, useValue: {} },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('CollectionsService financial posting safeguards', () => {
  const period = {
    id: 'period-1',
    status: 'OPEN',
    startDate: new Date('2026-11-01T00:00:00.000Z'),
    endDate: new Date('2026-11-30T23:59:59.999Z'),
  };

  function createFixture(duplicate: any = null) {
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      financialPeriod: { findUnique: jest.fn().mockResolvedValue(period) },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', branchId: 'branch-1', employmentStatus: 'ACTIVE' }) },
      customer: { findUnique: jest.fn().mockResolvedValue({ id: 'customer-1', branchId: 'branch-1' }) },
      dailyCollection: {
        findFirst: jest.fn().mockResolvedValue(duplicate),
        create: jest.fn().mockResolvedValue({ id: 'collection-1', reference: 'COL-REF-1' }),
        findUnique: jest.fn(),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
    };
    const staffWallet: any = {
      ensureTables: jest.fn().mockResolvedValue(undefined),
      debit: jest.fn().mockResolvedValue({}),
    };
    return { service: new CollectionsService(prisma, staffWallet), prisma, tx, staffWallet };
  }

  it('rejects repeated collection references without creating a second collection', async () => {
    const { service, tx } = createFixture({ id: 'existing-collection' });

    await expect(service.create({
      periodId: 'period-1',
      branchId: 'branch-1',
      staffId: 'staff-1',
      customerId: 'customer-1',
      type: 'LOAN_REPAYMENT',
      amount: 250,
      reference: 'COL-REF-1',
      collectionDate: '2026-11-09T10:00:00.000Z',
    })).rejects.toThrow('already been recorded');

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'DAILY-COLLECTION:branch-1:COL-REF-1',
    );
    expect(tx.dailyCollection.create).not.toHaveBeenCalled();
  });

  it('rejects collection work for a closed financial period inside the transaction', async () => {
    const { service, tx } = createFixture();
    tx.financialPeriod.findUnique.mockResolvedValue({ ...period, status: 'CLOSED' });

    await expect(service.create({
      periodId: 'period-1',
      branchId: 'branch-1',
      staffId: 'staff-1',
      customerId: 'customer-1',
      type: 'SAVINGS',
      amount: 100,
      reference: 'COL-CLOSED-1',
      collectionDate: '2026-11-09T10:00:00.000Z',
    })).rejects.toThrow('closed period');

    expect(tx.dailyCollection.create).not.toHaveBeenCalled();
  });

  it('rechecks settlement state under a row lock before any financial posting', async () => {
    const { service, prisma, tx, staffWallet } = createFixture();
    const initial = {
      id: 'collection-1',
      periodId: 'period-1',
      settled: false,
      branchId: 'branch-1',
      staffId: 'staff-1',
      customerId: 'customer-1',
      type: 'SAVINGS',
      amount: 250,
      reference: 'COL-REF-1',
      period: { status: 'OPEN' },
    };
    jest.spyOn(service, 'findOne').mockResolvedValue(initial as any);
    tx.dailyCollection.findUnique.mockResolvedValue({
      ...initial,
      settled: true,
      period: { status: 'OPEN' },
    });

    await expect(service.settle('collection-1', 'savings-1')).rejects.toThrow(
      'Collection has already been settled',
    );

    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      1,
      'SELECT id FROM "FinancialPeriod" WHERE id = $1 FOR UPDATE',
      'period-1',
    );
    expect(tx.$queryRawUnsafe).toHaveBeenNthCalledWith(
      2,
      'SELECT id FROM "DailyCollection" WHERE id = $1 FOR UPDATE',
      'collection-1',
    );
    expect(staffWallet.debit).not.toHaveBeenCalled();
    expect(tx.dailyCollection.update).toBeUndefined();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
