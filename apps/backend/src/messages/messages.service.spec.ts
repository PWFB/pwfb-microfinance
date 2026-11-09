import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MessagesService } from './messages.service';

describe('MessagesService messaging boundaries', () => {
  const prisma: any = {};
  const accessScope: any = {};
  const service = new MessagesService(prisma, accessScope);

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