import { CashbookService } from './cashbook.service';

describe('CashbookService', () => {
  it('should be defined', () => {
    const service = new CashbookService({} as any);
    expect(service).toBeDefined();
  });
});

describe('CashbookService daily posting safeguards', () => {
  const period = {
    id: 'period-1',
    status: 'OPEN',
    startDate: new Date('2026-11-01T00:00:00.000Z'),
    endDate: new Date('2026-11-30T23:59:59.999Z'),
  };

  function setup(queryResults: any[]) {
    const tx = {
      $queryRawUnsafe: jest.fn().mockImplementation(async () => queryResults.shift() ?? []),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      financialPeriod: { findUnique: jest.fn().mockResolvedValue(period) },
    };
    const prisma: any = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
      financialPeriod: { findUnique: jest.fn().mockResolvedValue(period) },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', branchId: 'branch-1', employmentStatus: 'ACTIVE' }) },
    };
    const service = new CashbookService(prisma);
    service.dailyOne = jest.fn().mockResolvedValue({ id: 'daily-1' }) as any;
    return { service, prisma, tx };
  }

  const input = {
    periodId: 'period-1',
    branchId: 'branch-1',
    staffId: 'staff-1',
    entryDate: '2026-11-09T12:00:00.000Z',
    savingsDeposits: 50,
    dailyDisbursementAmount: 25,
    // A browser-supplied opening amount must never override the prior close.
    previousCashAtHand: 999999,
  };

  it('serializes postings and carries forward the preceding closing cash', async () => {
    const { service, tx } = setup([
      [], // financial-period row lock
      [], // advisory lock
      [{ latestDay: '2026-11-08' }],
      [], // no existing record for this staff/date
      [{ other_after_total: '100.00' }],
    ]);

    await expect(service.createDaily(input)).resolves.toEqual({ id: 'daily-1' });

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'DAILY-CASHBOOK:branch-1:staff-1',
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const insertParameters = tx.$executeRawUnsafe.mock.calls[0];
    expect(insertParameters).toContain(100);
    expect(insertParameters).toContain(125);
  });


  it('rejects a period that closes after the initial check but before a daily post', async () => {
    const { service, tx } = setup([[]]);
    tx.financialPeriod.findUnique.mockResolvedValue({
      ...period,
      status: 'CLOSED',
    });

    await expect(service.createDaily(input)).rejects.toThrow('Cannot add entries to a closed period');
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('rejects a second daily register for the same branch, staff member and day', async () => {
    const { service, tx } = setup([
      [], // financial-period row lock
      [], // advisory lock
      [{ latestDay: '2026-11-08' }],
      [{ id: 'already-posted' }],
    ]);

    await expect(service.createDaily(input)).rejects.toThrow(
      'A daily cashbook record already exists',
    );
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(service.dailyOne).not.toHaveBeenCalled();
  });

  it('rejects backdated postings that would invalidate a later carry-forward', async () => {
    const { service, tx } = setup([
      [], // financial-period row lock
      [], // advisory lock
      [{ latestDay: '2026-11-10' }],
    ]);

    await expect(service.createDaily(input)).rejects.toThrow(
      'Daily cashbook work must be posted in date order',
    );
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});

describe('CashbookService manual ledger entries', () => {
  function setup(duplicate: any = null) {
    const entry = {
      id: 'cashbook-entry-1',
      periodId: 'period-1',
      branchId: 'branch-1',
      type: 'CASH_IN',
      amount: 50,
      reference: 'BANK-REF-001',
    };
    const tx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      cashbookEntry: {
        findFirst: jest.fn().mockResolvedValue(duplicate),
        create: jest.fn().mockResolvedValue(entry),
      },
    };
    const prisma: any = {
      financialPeriod: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'period-1',
          status: 'OPEN',
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-30T23:59:59.999Z'),
        }),
      },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'branch-1' }) },
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
    };
    return { service: new CashbookService(prisma), prisma, tx, entry };
  }

  it('serializes manual entries and rejects duplicate branch references', async () => {
    const { service, tx, entry } = setup({ id: 'existing-entry' });

    await expect(service.create({
      periodId: 'period-1',
      branchId: 'branch-1',
      type: 'CASH_IN',
      amount: 50,
      reference: 'BANK-REF-001',
      entryDate: '2026-11-09T12:00:00.000Z',
    })).rejects.toThrow('already been recorded');

    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      'CASHBOOK-ENTRY:branch-1:BANK-REF-001',
    );
    expect(tx.cashbookEntry.create).not.toHaveBeenCalled();
  });


  it('rejects a period closed after the manual entry pre-check', async () => {
    const { service, tx } = setup();
    tx.financialPeriod.findUnique.mockResolvedValue({
      id: 'period-1',
      status: 'CLOSED',
      startDate: new Date('2026-11-01T00:00:00.000Z'),
      endDate: new Date('2026-11-30T23:59:59.999Z'),
    });

    await expect(service.create({
      periodId: 'period-1',
      branchId: 'branch-1',
      type: 'CASH_IN',
      amount: 50,
      reference: 'BANK-REF-CLOSED',
      entryDate: '2026-11-09T12:00:00.000Z',
    })).rejects.toThrow('Cannot add cashbook entries to a closed period');
    expect(tx.cashbookEntry.create).not.toHaveBeenCalled();
  });

  it('creates a unique reference when a manual entry has no reference', async () => {
    const { service, tx, entry } = setup();

    await expect(service.create({
      periodId: 'period-1',
      branchId: 'branch-1',
      type: 'CASH_IN',
      amount: 50,
      entryDate: '2026-11-09T12:00:00.000Z',
    })).resolves.toBe(entry);

    expect(tx.cashbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reference: expect.stringMatching(/^MANUAL-CASHBOOK-/) }),
    }));
  });
});
