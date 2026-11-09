import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ChargesService } from './charges.service';

describe('ChargesService central registration fee', () => {
  function scopeFixture(role = 'CREDIT_OFFICER') {
    const tx = {
      $queryRawUnsafe: jest.fn(),
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'period-1',
          status: 'OPEN',
          startDate: new Date('2026-11-01T00:00:00.000Z'),
          endDate: new Date('2026-11-30T23:59:59.999Z'),
        }),
      },
      cashbookEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cashbook-entry-1' }),
      },
    };
    const prisma: any = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) => callback(tx)),
      staff: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'staff-1',
          branchId: 'branch-1',
          employmentStatus: 'ACTIVE',
        }),
      },
    };
    const accessScope: any = {
      getScope: jest.fn().mockResolvedValue({
        role,
        staffId: 'staff-1',
        branchId: 'branch-1',
        global: false,
      }),
      assertBranch: jest.fn().mockResolvedValue(true),
      assertStaff: jest.fn().mockResolvedValue(true),
    };
    return { service: new ChargesService(prisma, accessScope), prisma, tx, accessScope };
  }

  it('creates the default customer registration charge as ₦1,500', async () => {
    const { service, prisma } = scopeFixture();
    prisma.$queryRawUnsafe.mockResolvedValueOnce([{
      key: 'CUSTOMER_REGISTRATION',
      amount: '1500',
      currency: 'NGN',
      updatedAt: new Date('2026-11-01T00:00:00.000Z'),
    }]);

    await expect(service.getRegistrationCharge()).resolves.toMatchObject({
      key: 'CUSTOMER_REGISTRATION',
      amount: 1500,
      currency: 'NGN',
    });
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('VALUES (\'CUSTOMER_REGISTRATION\',1500,\'NGN\')'));
  });

  it('allows only Super Admin to change the central fee', async () => {
    const { service } = scopeFixture();
    await expect(service.updateRegistrationCharge(2000, 'Approved annual fee review', {
      id: 'branch-admin',
      role: 'ADMIN',
      email: 'admin@example.test',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('records every Super Admin charge change with the previous amount, reason and actor', async () => {
    const { service, prisma, tx } = scopeFixture('SUPER_ADMIN');
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: '1500', currency: 'NGN' }]);

    const result = await service.updateRegistrationCharge(2000, 'Approved annual fee review', {
      id: 'root-user',
      role: 'SUPER_ADMIN',
      email: 'root@example.test',
    });

    expect(result).toMatchObject({ previousAmount: 1500, amount: 2000, currency: 'NGN' });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "PWFBChargeChangeAudit"'),
      expect.any(String),
      1500,
      2000,
      'NGN',
      'Approved annual fee review',
      'root-user',
      'root@example.test',
    );
  });

  it('records a registration receipt and cashbook CASH_IN using the authenticated branch and staff', async () => {
    const { service, tx, prisma } = scopeFixture('TELLER');
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([]) // charge configuration lock
      .mockResolvedValueOnce([{ amount: 1500, currency: 'NGN' }])
      .mockResolvedValueOnce([]) // reference advisory lock
      .mockResolvedValueOnce([]); // no duplicate receipt

    const receipt = await service.collectRegistrationFee({
      reference: 'CASH-REC-001',
      paymentMethod: 'CASH',
      confirmedReceived: true,
    }, { id: 'teller-user', role: 'TELLER', email: 'teller@example.test' });

    expect(receipt).toMatchObject({
      amount: 1500,
      currency: 'NGN',
      paymentMethod: 'CASH',
      reference: 'CASH-REC-001',
      branchId: 'branch-1',
      staffId: 'staff-1',
      status: 'COLLECTED',
      providerVerified: false,
    });
    expect(prisma.staff.findUnique).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      select: { id: true, branchId: true, employmentStatus: true },
    });
    expect(tx.cashbookEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        branchId: 'branch-1',
        type: 'CASH_IN',
        amount: 1500,
        reference: 'REGFEE-CASH-REC-001',
      }),
    }));
  });

  it('does not create a fee receipt unless receipt of the money is confirmed', async () => {
    const { service, prisma } = scopeFixture('TELLER');
    await expect(service.collectRegistrationFee({
      reference: 'CASH-REC-002',
      paymentMethod: 'CASH',
      confirmedReceived: false,
    }, { id: 'teller-user', role: 'TELLER' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents a registration receipt from being consumed for a different branch', async () => {
    const { service, tx } = scopeFixture();
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        amount: 1500,
        branchId: 'branch-other',
        staffId: 'staff-1',
        status: 'COLLECTED',
        customerId: null,
        reference: 'CASH-REC-003',
      }]);

    await expect(service.consumeRegistrationReceipt(
      tx,
      'receipt-1',
      'customer-1',
      'branch-1',
      'staff-1',
    )).rejects.toThrow('same branch');
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining("SET \"status\"='USED'"),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('links a collected fee receipt to one customer and records both collector and assigned staff', async () => {
    const { service, tx } = scopeFixture();
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([]) // row lock
      .mockResolvedValueOnce([{
        amount: 1500,
        branchId: 'branch-1',
        staffId: 'teller-1',
        status: 'COLLECTED',
        customerId: null,
        reference: 'CASH-REC-004',
      }]);

    const result = await service.consumeRegistrationReceipt(
      tx,
      'receipt-1',
      'customer-1',
      'branch-1',
      'credit-officer-1',
    );

    expect(result).toMatchObject({
      receiptId: 'receipt-1',
      reference: 'CASH-REC-004',
      amount: 1500,
      collectedByStaffId: 'teller-1',
      registeredByStaffId: 'credit-officer-1',
    });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('SET "status"=\'USED\',"customerId"=$1,"usedByStaffId"=$3'),
      'customer-1',
      'receipt-1',
      'credit-officer-1',
    );
  });
  it('lets a same-branch Credit Officer use a Teller-collected receipt without posting a second cashbook entry', async () => {
    const { service, tx, accessScope, prisma } = scopeFixture('CREDIT_OFFICER');
    accessScope.getScope.mockResolvedValue({
      role: 'CREDIT_OFFICER',
      staffId: 'credit-officer-1',
      branchId: 'branch-1',
      global: false,
    });
    prisma.staff.findUnique.mockResolvedValue({
      id: 'credit-officer-1',
      branchId: 'branch-1',
      employmentStatus: 'ACTIVE',
    });
    tx.$queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: 1500, currency: 'NGN' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        id: 'receipt-from-teller',
        amount: 1500,
        currency: 'NGN',
        paymentMethod: 'CASH',
        branchId: 'branch-1',
        staffId: 'teller-1',
        status: 'COLLECTED',
        customerId: null,
        cashbookEntryId: 'cashbook-entry-1',
      }]);

    const receipt = await service.collectRegistrationFee({
      reference: 'TELLER-REC-005',
      paymentMethod: 'CASH',
      confirmedReceived: true,
    }, { id: 'officer-user', role: 'CREDIT_OFFICER' });

    expect(receipt).toMatchObject({
      id: 'receipt-from-teller',
      amount: 1500,
      staffId: 'teller-1',
      branchId: 'branch-1',
      reused: true,
    });
    expect(tx.cashbookEntry.create).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "PWFBRegistrationChargeReceipt"'),
      expect.anything(),
    );
  });

});