import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';

describe('MessagesService messaging boundaries', () => {
  const prisma: any = {};
  const accessScope: any = {};
  const service = new MessagesService(prisma, accessScope);

  it('detects recipient roles from active branch assignments even when the primary Staff.branchId differs', async () => {
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([
      { roleTarget: 'CREDIT_OFFICER' },
      { roleTarget: 'TELLER' },
      { roleTarget: 'CUSTOMER' },
    ]);

    await expect(service.getBranchRoleTargets(
      { id: 'manager-user', role: 'BRANCH_MANAGER', staffId: 'staff-1' },
      'assigned-branch-2',
    )).resolves.toEqual(['CREDIT_OFFICER', 'TELLER']);

    const [sql, branchId, allowedRoles] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(branchId).toBe('assigned-branch-2');
    expect(allowedRoles).toContain('CREDIT_OFFICER');
    expect(sql).toContain('FROM "StaffAssignment" a');
    expect(sql).toContain('a."branchId" = $1');
    expect(sql).toContain('a."active" = TRUE');
    expect(sql).toContain('a."startsAt" <= CURRENT_TIMESTAMP');
    expect(sql).toContain('a."endsAt" > CURRENT_TIMESTAMP');
  });

  it('accepts a role recipient linked through an active StaffAssignment for the selected branch', async () => {
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{ count: 1 }]);

    await expect((service as any).hasActiveRoleInBranch('assigned-branch-2', 'TELLER'))
      .resolves.toBe(true);

    const [sql, branchId, role] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(branchId).toBe('assigned-branch-2');
    expect(role).toBe('TELLER');
    expect(sql).toContain('FROM "StaffAssignment" a');
    expect(sql).toContain('a."branchId" = $1');
    expect(sql).toContain('a."role"::text = $2');
    expect(sql).toContain('a."active" = TRUE');
  });

  it('lists active staff assigned to the chosen branch even when their home branch is different', async () => {
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([
      { staffId: 'staff-2', userId: 'user-2', firstName: 'Branch', lastName: 'Officer', role: 'CREDIT_OFFICER' },
    ]);

    const result = await service.getBranchStaff(
      { id: 'manager-user', role: 'BRANCH_MANAGER', staffId: 'manager-staff' },
      'assigned-branch-2',
    );

    expect(result).toHaveLength(1);
    const [sql, branchId] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(branchId).toBe('assigned-branch-2');
    expect(sql).toContain('LEFT JOIN LATERAL (SELECT a."role" FROM "StaffAssignment" a');
    expect(sql).toContain('(s."branchId" = $1 OR sa."role" IS NOT NULL)');
    expect(sql).toContain('COALESCE(sa."role"::text, u."role"::text)');
  });

  it('rejects role targets outside the branch-role allowlist', async () => {
    accessScope.getScope = jest.fn().mockResolvedValue({ role: 'TELLER', staffId: 'staff-1', branchId: 'branch-1', global: false });
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{ id: 'conversation-1' }]);
    await expect(service.sendToRole(
      { id: 'user-1', role: 'TELLER', staffId: 'staff-1' },
      { branchId: 'branch-1', roleTarget: 'CUSTOMER', message: 'Not allowed' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses group chats with only one other participant (no disguised direct messages)', async () => {
    accessScope.getScope = jest.fn().mockResolvedValue({ role: 'TELLER', staffId: 'staff-1', branchId: 'branch-1', global: false });
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    await expect(service.createGroup(
      { id: 'user-1', role: 'TELLER', staffId: 'staff-1' },
      { branchId: 'branch-1', title: 'Pair chat', staffIds: ['staff-2'] },
    )).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a role channel when that role has no active staff member in the branch', async () => {
    accessScope.getScope = jest.fn().mockResolvedValue({ role: 'TELLER', staffId: 'staff-1', branchId: 'branch-1', global: false });
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([{ count: 0 }]);
    await expect(service.sendToRole(
      { id: 'user-1', role: 'TELLER', staffId: 'staff-1' },
      { branchId: 'branch-1', roleTarget: 'BRANCH_MANAGER', message: 'Branch update' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not expose a role channel to another role that did not participate', async () => {
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
    await expect((service as any).assertConversationVisible(
      { id: 'user-2', role: 'TELLER', staffId: 'staff-2' },
      { id: 'conversation-1', branchId: 'branch-1', type: 'ROLE', roleTarget: 'BRANCH_MANAGER', createdByUserId: 'user-1' },
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not expose a staff group to a non-member outside the admin scope', async () => {
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    prisma.$queryRawUnsafe = jest.fn().mockResolvedValue([]);
    await expect((service as any).assertConversationVisible(
      { id: 'user-2', role: 'TELLER', staffId: 'staff-2' },
      { id: 'group-1', branchId: 'branch-1', type: 'GROUP' },
    )).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a scoped Super Admin without a staff record to create a branch group', async () => {
    accessScope.getScope = jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN', staffId: null, branchId: null, global: true });
    accessScope.assertBranch = jest.fn().mockResolvedValue(true);
    const conversation = { id: 'conversation-1', branchId: 'branch-1', type: 'GROUP', title: 'Branch Review', createdByUserId: 'admin-user' };
    prisma.$queryRawUnsafe = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT ON')) return Promise.resolve([
        { staffId: 'staff-2', userId: 'user-2' },
        { staffId: 'staff-3', userId: 'user-3' },
      ]);
      if (sql.includes('SELECT * FROM "BranchMessageConversation"')) return Promise.resolve([conversation]);
      if (sql.includes('SELECT m."id"')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    prisma.$executeRawUnsafe = jest.fn().mockResolvedValue(1);
    prisma.$transaction = jest.fn(async (callback: any) => callback({
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: 'conversation-1' }]),
    }));
    await expect(service.createGroup(
      { id: 'admin-user', role: 'SUPER_ADMIN' },
      { branchId: 'branch-1', title: 'Branch Review', staffIds: ['staff-2', 'staff-3'] },
    )).resolves.toMatchObject({ conversation: expect.objectContaining({ id: 'conversation-1' }), messages: [] });
  });

});