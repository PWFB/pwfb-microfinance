import { ForbiddenException } from '@nestjs/common';
import { BranchClosingService } from './branch-closing.service';

describe('BranchClosingService branch assignment scope', () => {
  const prisma: any = {
    $executeRawUnsafe: jest.fn().mockResolvedValue(1),
    $queryRawUnsafe: jest.fn(),
  };
  const scope: any = {
    assertBranch: jest.fn().mockResolvedValue(true),
    getScopedBranchIds: jest.fn(),
  };
  const audit: any = { record: jest.fn().mockResolvedValue(undefined) };
  let service: BranchClosingService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    service = new BranchClosingService(prisma, scope, audit);
  });

  it('filters branch closing history to all and only the assigned branch IDs', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'closing-a', branchId: 'branch-a' },
      { id: 'closing-b', branchId: 'branch-b' },
    ]);
    scope.getScopedBranchIds.mockResolvedValue(['branch-a']);

    const rows = await service.list({ id: 'manager-user', role: 'AREA_MANAGER' });

    expect(rows).toEqual([{ id: 'closing-a', branchId: 'branch-a' }]);
  });

  it('does not approve a closing from a branch outside the Admin active assignment', async () => {
    const user = { id: 'branch-admin', role: 'ADMIN' };
    prisma.$queryRawUnsafe.mockResolvedValue([{
      id: 'closing-b',
      branchId: 'branch-b',
      status: 'SUBMITTED',
      periodId: 'period-1',
      closingDate: '2026-11-09',
    }]);
    scope.assertBranch.mockRejectedValue(new ForbiddenException('Branch is outside active assignment'));

    await expect(service.approve(user, 'closing-b')).rejects.toBeInstanceOf(ForbiddenException);

    expect(scope.assertBranch).toHaveBeenCalledWith(user, 'branch-b');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1); // table setup only; no approval update
    expect(audit.record).not.toHaveBeenCalled();
  });
});
