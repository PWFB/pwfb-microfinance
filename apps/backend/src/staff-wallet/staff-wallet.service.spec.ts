import { StaffWalletService } from './staff-wallet.service';

describe('StaffWalletService transaction safety', () => {
  it('wraps a direct credit in one database transaction', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([]) // advisory lock
        .mockResolvedValueOnce([]) // no duplicate reference
        .mockResolvedValueOnce([]) // no existing staff wallet
        .mockResolvedValueOnce([{ id: 'staff-1', branchId: 'branch-1', employmentStatus: 'ACTIVE' }])
        .mockResolvedValueOnce([{ id: 'wallet-1', staffId: 'staff-1', branchId: 'branch-1', balance: 0 }])
        .mockResolvedValueOnce([{ balance: 0 }]),
    };
    const prisma: any = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
    };
    const service = new StaffWalletService(prisma);

    const result = await service.credit('staff-1', 250, 'TEST-REF-1');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'wallet-1',
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE staff_wallets'),
      'wallet-1',
      250,
    );
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO staff_wallet_transactions'),
      expect.any(String),
      'wallet-1',
      250,
      0,
      250,
      'TEST-REF-1',
      'Field cash issued to staff',
    );
    expect(result).toEqual({
      staffId: 'staff-1',
      previousBalance: 0,
      amount: 250,
      newBalance: 250,
    });
  });

  it('rejects a duplicate transaction reference before changing the balance', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([]) // advisory lock
        .mockResolvedValueOnce([{ id: 'existing-tx' }]), // reference already used
    };
    const prisma: any = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
    };
    const service = new StaffWalletService(prisma);

    await expect(service.credit('staff-1', 250, 'DUPLICATE-REF')).rejects.toThrow(
      'Staff wallet transaction reference already exists',
    );
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE staff_wallets'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rejects a settlement when the locked balance is insufficient', async () => {
    const tx = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn()
        .mockResolvedValueOnce([{ id: 'wallet-1', staffId: 'staff-1', branchId: 'branch-1', balance: 10 }])
        .mockResolvedValueOnce([{ balance: 10 }]),
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: (client: any) => unknown) => callback(tx)),
    };
    const service = new StaffWalletService(prisma);

    await expect(service.debit('staff-1', 20, 'TEST-REF-2')).rejects.toThrow(
      'Insufficient staff wallet balance',
    );
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE staff_wallets'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('rounds valid wallet amounts to two decimal places', async () => {
    const prisma: any = {};
    const service = new StaffWalletService(prisma);
    expect((service as any).amount(12.345)).toBe(12.35);
    expect((service as any).amount(12.344)).toBe(12.34);
    expect(() => (service as any).amount(0.001)).toThrow('Wallet amount must be at least ₦0.01');
  });
});
