import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CashbookService access and daily cash', () => {
  let service: CashbookService;
  let prisma: any;

  const profile = {
    id: 'staff-internal-1', staffId: 'PWFB-001', firstName: 'Ada', lastName: 'Okafor',
    position: 'Credit Officer', branchId: 'branch-1', regionId: null, divisionId: null, areaId: null, employmentStatus: 'ACTIVE',
  };
  const actor = { id: 'user-1', role: 'CREDIT_OFFICER', staffId: profile.id };

  beforeEach(() => {
    prisma = {
      staff: { findFirst: jest.fn().mockResolvedValue(profile), findUnique: jest.fn(), findMany: jest.fn() },
      branch: { findMany: jest.fn().mockResolvedValue([{ id: 'branch-1', name: 'Main Branch' }]), findUnique: jest.fn() },
      financialPeriod: { findMany: jest.fn().mockResolvedValue([{ id: 'period-1', name: 'November 2026', status: 'OPEN' }]), findUnique: jest.fn() },
      staffAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      cashbookEntry: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new CashbookService(prisma as PrismaService);
  });

  it('returns only the signed-in staff identity and assigned branch for an individual staff role', async () => {
    const result = await service.getAccess(actor);
    expect(result).toMatchObject({
      selfOnly: true, canSelectBranch: false, canSelectStaff: false,
      branchId: 'branch-1', staffId: 'staff-internal-1',
      currentStaff: { staffId: 'PWFB-001', firstName: 'Ada', lastName: 'Okafor' },
      branches: [{ id: 'branch-1', name: 'Main Branch' }],
    });
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  it('denies staff accounts that have no linked Staff ID', async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    await expect(service.getAccess(actor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects requests to read another branch before querying the daily register', async () => {
    await expect(service.findDaily('period-1', 'branch-2', undefined, undefined, actor))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('carries forward only the previous closing cash for the same branch and Staff ID', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ other_after_total: 27500 }]);
    const result = await service.getOpeningBalance(actor, 'branch-1', 'staff-internal-1', '2026-11-09');
    expect(result).toEqual({ balance: 27500 });
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('branch_id=$1 AND staff_id=$2'),
      'branch-1', 'staff-internal-1', expect.any(Date),
    );
  });

  it('keeps posted daily rows immutable after checking caller scope', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{
      id: 'row-1', branch_id: 'branch-1', staff_id: 'staff-internal-1',
      entry_date: new Date('2026-11-08T00:00:00Z'), branch_name: 'Main Branch', period_name: 'November 2026',
    }]);
    await expect(service.removeDaily('row-1', actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
