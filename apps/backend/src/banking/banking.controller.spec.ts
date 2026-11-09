import { BankingController } from './banking.controller';
import { PermissionsService } from '../permissions/permissions.service';

describe('BankingController customer virtual-account consent forwarding', () => {
  it('forwards explicit consent to the DVA service', async () => {
    const customerVirtualAccountService = { ensure: jest.fn().mockResolvedValue([{ status: 'PENDING' }]) };
    const controller = new BankingController(
      {} as any,
      customerVirtualAccountService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await controller.ensureCustomerVirtualAccount(
      'customer-1',
      { institutionId: 'paystack', consentConfirmed: true },
      { user: { role: 'ADMIN' } },
    );

    expect(customerVirtualAccountService.ensure).toHaveBeenCalledWith('customer-1', 'paystack', true);
    expect(result).toEqual([{ status: 'PENDING' }]);
  });

  it('does not infer consent when the request omits confirmation', async () => {
    const customerVirtualAccountService = { ensure: jest.fn().mockResolvedValue([]) };
    const controller = new BankingController(
      {} as any,
      customerVirtualAccountService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await controller.ensureCustomerVirtualAccount(
      'customer-1',
      {},
      { user: { role: 'ADMIN' } },
    );

    expect(customerVirtualAccountService.ensure).toHaveBeenCalledWith('customer-1', undefined, false);
  });
});

describe('BankingController staff attribution', () => {
  it('resolves an active staff record through userId when User.staffId is absent', async () => {
    const prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'customer-1',
          branchId: 'branch-1',
          assignedStaffId: 'staff-1',
        }),
      },
      staff: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
          branchId: 'branch-1',
          employmentStatus: 'ACTIVE',
        }),
      },
    };
    const controller = new BankingController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      prisma as any,
    );

    const result = await (controller as any).operatorAttribution(
      { id: 'user-1', role: 'CREDIT_OFFICER' },
      'customer-1',
    );

    expect(prisma.staff.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ userId: 'user-1' }] },
      select: { id: true, branchId: true, employmentStatus: true },
    });
    expect(result).toEqual({ staffId: 'staff-1', branchId: 'branch-1' });
  });

  it('rejects inactive linked staff before attributing a cash operation', async () => {
    const prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'customer-1',
          branchId: 'branch-1',
          assignedStaffId: 'staff-1',
        }),
      },
      staff: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'staff-1',
          branchId: 'branch-1',
          employmentStatus: 'INACTIVE',
        }),
      },
    };
    const controller = new BankingController(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      prisma as any,
    );

    await expect((controller as any).operatorAttribution(
      { id: 'user-1', role: 'TELLER' },
      'customer-1',
    )).rejects.toThrow('active staff member');
  });
});

describe('Teller separation of duties', () => {
  it.each(['WALLET_WITHDRAWAL', 'BANK_TRANSFER', 'SAVINGS_WITHDRAW', 'LOAN_CREATE', 'LOAN_DISBURSE'] as const)(
    'denies Teller permission %s even if a stored permission lookup would return true',
    async (permission) => {
      const permissions = new PermissionsService({} as any);
      const get = jest.spyOn(permissions, 'get').mockResolvedValue(true);
      await expect(permissions.assert('TELLER', permission)).rejects.toThrow(
        `${permission} is not available to Tellers`,
      );
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('still allows a Teller cash deposit when explicitly enabled', async () => {
    const permissions = new PermissionsService({} as any);
    jest.spyOn(permissions, 'get').mockResolvedValue(true);
    await expect(permissions.assert('TELLER', 'WALLET_DEPOSIT')).resolves.toBe(true);
  });

  it('hides stale Teller withdrawal/transfer permissions from the role settings list', async () => {
    const prisma = {
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { role: 'TELLER', permission: 'WALLET_WITHDRAWAL', enabled: true },
        { role: 'TELLER', permission: 'BANK_TRANSFER', enabled: true },
      ]),
    };
    const permissions = new PermissionsService(prisma as any);
    const roles = await permissions.list();
    const teller = roles.find((item: any) => item.role === 'TELLER');

    expect(teller.permissions.WALLET_WITHDRAWAL).toBe(false);
    expect(teller.permissions.BANK_TRANSFER).toBe(false);
  });

  it('rejects attempts to enable a restricted Teller permission', async () => {
    const permissions = new PermissionsService({} as any);
    await expect(permissions.set('TELLER', 'WALLET_WITHDRAWAL', true)).rejects.toThrow(
      'WALLET_WITHDRAWAL is not available to Tellers',
    );
  });
});

describe('BankingController branch virtual-account scope', () => {
  it('checks the target account branch before manually recording a deposit', async () => {
    const bankingService = { recordBranchDeposit: jest.fn().mockResolvedValue({ ok: true }) };
    const prisma = {
      branchVirtualAccount: {
        findUnique: jest.fn().mockResolvedValue({ branchId: 'branch-1' }),
      },
    };
    const accessScope = { assertBranch: jest.fn().mockResolvedValue(true) };
    const controller = new BankingController(
      bankingService as any,
      {} as any,
      {} as any,
      {} as any,
      prisma as any,
      accessScope as any,
    );

    await expect(controller.recordBranchDeposit(
      { accountNumber: '1234567890', amount: 50, reference: 'BANK-REF-001' },
      { user: { id: 'manager-1', role: 'BRANCH_MANAGER' } },
    )).resolves.toEqual({ ok: true });

    expect(accessScope.assertBranch).toHaveBeenCalledWith(
      { id: 'manager-1', role: 'BRANCH_MANAGER' },
      'branch-1',
    );
    expect(bankingService.recordBranchDeposit).toHaveBeenCalledWith({
      accountNumber: '1234567890',
      amount: 50,
      reference: 'BANK-REF-001',
    });
  });

  it('does not post a branch deposit outside the caller scope', async () => {
    const bankingService = { recordBranchDeposit: jest.fn() };
    const prisma = {
      branchVirtualAccount: {
        findUnique: jest.fn().mockResolvedValue({ branchId: 'other-branch' }),
      },
    };
    const accessScope = { assertBranch: jest.fn().mockRejectedValue(new Error('outside your organizational scope')) };
    const controller = new BankingController(
      bankingService as any,
      {} as any,
      {} as any,
      {} as any,
      prisma as any,
      accessScope as any,
    );

    await expect(controller.recordBranchDeposit(
      { accountNumber: '1234567890', amount: 50, reference: 'BANK-REF-002' },
      { user: { id: 'manager-1', role: 'BRANCH_MANAGER' } },
    )).rejects.toThrow('outside your organizational scope');
    expect(bankingService.recordBranchDeposit).not.toHaveBeenCalled();
  });
});
