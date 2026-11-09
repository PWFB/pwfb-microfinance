import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

type MessageActor = { id: string; role: string; staffId?: string };
const ROLE_CHANNEL_TARGETS = new Set([
  'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER',
  'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'AUDITOR', 'MONITORING_TEAM',
  'STAFF',
]);
const ADMIN_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private normalizeActor(actor: MessageActor) {
    const id = String(actor?.id || '').trim();
    const role = String(actor?.role || '').trim().toUpperCase();
    if (!id || !role || role === 'CUSTOMER') throw new ForbiddenException('Staff messaging is available only to authenticated staff and administrators');
    const staffId = actor.staffId ? String(actor.staffId) : undefined;
    return { id, role, ...(staffId ? { staffId } : {}) };
  }

  private async scopeFor(actor: MessageActor) {
    const normalized = this.normalizeActor(actor);
    const scope = await this.accessScope.getScope(normalized);
    if (normalized.role !== 'SUPER_ADMIN' && !scope.staffId) {
      throw new ForbiddenException('Your login is not linked to an active branch staff record');
    }
    return { actor: normalized, scope };
  }

  private async accessibleBranchIds(actor: MessageActor): Promise<string[]> {
    const { scope } = await this.scopeFor(actor);
    if (scope.global) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Branch" ORDER BY "name" ASC');
      return rows.map((row) => String(row.id));
    }
    const ids = await this.accessScope.getScopedBranchIds(actor);
    return (ids || []).map((id) => String(id));
  }

  private async assertBranch(actor: MessageActor, branchId: string) {
    const id = String(branchId || '').trim();
    if (!id) throw new BadRequestException('Choose a branch');
    await this.accessScope.assertBranch(actor, id);
    return id;
  }

  private isAdmin(actor: MessageActor) {
    return ADMIN_ROLES.has(String(actor.role || '').toUpperCase());
  }

  private validateMessage(message: string) {
    const value = String(message ?? '').trim();
    if (!value) throw new BadRequestException('Message cannot be empty');
    if (value.length > 5000) throw new BadRequestException('Messages must be 5,000 characters or fewer');
    return value;
  }

  async getContext(actor: MessageActor) {
    const result = await this.scopeFor(actor);
    const branchIds = await this.accessibleBranchIds(result.actor);
    if (!branchIds.length) {
      return {
        userRole: result.actor.role,
        currentBranchId: null,
        canMonitorAllBranchMessages: this.isAdmin(result.actor),
        branches: [],
        roleTargets: [],
      };
    }
    const branches = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT "id", "name" FROM "Branch" WHERE "id" = ANY($1::text[]) ORDER BY "name" ASC',
      branchIds,
    );
    const currentBranchId = branches.some((item) => String(item.id) === String(result.scope.branchId))
      ? result.scope.branchId
      : branches.length === 1 ? String(branches[0].id) : null;
    const roleTargets = currentBranchId
      ? await this.getBranchRoleTargets(result.actor, currentBranchId)
      : [];
    return {
      userRole: result.actor.role,
      currentBranchId,
      canMonitorAllBranchMessages: this.isAdmin(result.actor),
      branches,
      roleTargets,
    };
  }

  async getBranchRoleTargets(actor: MessageActor, branchId: string) {
    const id = await this.assertBranch(actor, branchId);
    const allowed = [...ROLE_CHANNEL_TARGETS];
    const rows = await this.prisma.$queryRawUnsafe<Array<{ roleTarget: string }>>(
      'SELECT DISTINCT roleTarget FROM (' +
      'SELECT u."role"::text AS roleTarget FROM "Staff" s ' +
      'JOIN LATERAL (SELECT u."id", u."role" FROM "User" u ' +
      'WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'WHERE s."branchId" = $1 AND s."employmentStatus" = \'ACTIVE\' ' +
      'UNION ' +
      'SELECT a."role"::text AS roleTarget FROM "StaffAssignment" a ' +
      'JOIN "Staff" s ON s."id" = a."staffId" ' +
      'WHERE a."branchId" = $1 AND a."active" = TRUE ' +
      'AND a."startsAt" <= CURRENT_TIMESTAMP ' +
      'AND (a."endsAt" IS NULL OR a."endsAt" > CURRENT_TIMESTAMP) ' +
      'AND s."employmentStatus" = \'ACTIVE\'' +
      ') available WHERE roleTarget = ANY($2::text[])',
      id, allowed,
    );
    const available = new Set(rows.map((row) => String(row.roleTarget).toUpperCase()));
    return allowed.filter((role) => available.has(role));
  }

  async getBranchStaff(actor: MessageActor, branchId: string) {
    const id = await this.assertBranch(actor, branchId);
    return this.prisma.$queryRawUnsafe<any[]>(
      'SELECT DISTINCT ON (s."id") s."id" AS "staffId", u."id" AS "userId", ' +
      's."firstName", s."lastName", s."position", COALESCE(sa."role"::text, u."role"::text) AS "role" ' +
      'FROM "Staff" s JOIN LATERAL (SELECT u."id", u."role" FROM "User" u ' +
      'WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'LEFT JOIN LATERAL (SELECT a."role" FROM "StaffAssignment" a ' +
      'WHERE a."staffId" = s."id" AND a."branchId" = $1 AND a."active" = TRUE ' +
      'AND a."startsAt" <= CURRENT_TIMESTAMP AND (a."endsAt" IS NULL OR a."endsAt" > CURRENT_TIMESTAMP) ' +
      'ORDER BY a."startsAt" DESC, a."updatedAt" DESC LIMIT 1) sa ON TRUE ' +
      'WHERE s."employmentStatus" = \'ACTIVE\' AND (s."branchId" = $1 OR sa."role" IS NOT NULL) ' +
      'AND (u."role" <> \'CUSTOMER\' OR sa."role" IS NOT NULL) ' +
      'ORDER BY s."id", s."firstName", s."lastName"',
      id,
    );
  }

  async listConversations(actor: MessageActor) {
    const normalized = this.normalizeActor(actor);
    const branchIds = await this.accessibleBranchIds(normalized);
    if (!branchIds.length) return [];
    const sql = [
      'SELECT c."id", c."branchId", b."name" AS "branchName", c."type",',
      'c."roleTarget", c."title", c."lastMessageAt", c."createdAt",',
      'lm."body" AS "lastMessage", lm."createdAt" AS "lastMessageCreatedAt",',
      'lm."senderUserId" AS "lastSenderUserId",',
      'COUNT(msg."id") FILTER (WHERE msg."id" IS NOT NULL AND msg."createdAt" > COALESCE(rs."lastReadAt", TIMESTAMP \'epoch\') AND msg."senderUserId" <> $2)::int AS "unreadCount",',
      'CASE WHEN c."type" = \'GROUP\' THEN (SELECT COUNT(*)::int FROM "BranchMessageMember" gm WHERE gm."conversationId" = c."id")',
      'ELSE (SELECT COUNT(*)::int FROM "Staff" s WHERE s."branchId" = c."branchId" AND s."employmentStatus" = \'ACTIVE\') END AS "participantCount"',
      'FROM "BranchMessageConversation" c JOIN "Branch" b ON b."id" = c."branchId"',
      'LEFT JOIN "BranchMessageReadState" rs ON rs."conversationId" = c."id" AND rs."userId" = $2',
      'LEFT JOIN "BranchMessage" msg ON msg."conversationId" = c."id"',
      'LEFT JOIN LATERAL (SELECT m."body", m."createdAt", m."senderUserId" FROM "BranchMessage" m WHERE m."conversationId" = c."id" ORDER BY m."createdAt" DESC LIMIT 1) lm ON TRUE',
      'WHERE c."branchId" = ANY($1::text[]) AND (',
      '(c."type" = \'ROLE\' AND (c."roleTarget" = $3 OR $4::boolean = TRUE OR EXISTS (SELECT 1 FROM "BranchMessage" own WHERE own."conversationId" = c."id" AND own."senderUserId" = $2)))',
      'OR (c."type" = \'GROUP\' AND ($4::boolean = TRUE OR EXISTS (SELECT 1 FROM "BranchMessageMember" gm WHERE gm."conversationId" = c."id" AND gm."userId" = $2))))',
      'GROUP BY c."id", b."name", rs."lastReadAt", lm."body", lm."createdAt", lm."senderUserId"',
      'ORDER BY COALESCE(lm."createdAt", c."createdAt") DESC',
    ].join(' ');
    const conversations = await this.prisma.$queryRawUnsafe<any[]>(
      sql, branchIds, normalized.id, normalized.role, this.isAdmin(normalized),
    );
    return conversations;
  }

  private async loadConversation(conversationId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "BranchMessageConversation" WHERE "id" = $1 LIMIT 1',
      String(conversationId || '').trim(),
    );
    if (!rows[0]) throw new NotFoundException('Message conversation not found');
    return rows[0];
  }

  private async assertConversationVisible(actor: MessageActor, conversation: any) {
    const normalized = this.normalizeActor(actor);
    await this.accessScope.assertBranch(normalized, String(conversation.branchId));
    if (this.isAdmin(normalized)) return true;
    if (conversation.type === 'ROLE') {
      if (String(conversation.roleTarget) === normalized.role) return true;
      if (String(conversation.createdByUserId) === normalized.id) return true;
      const sent = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT 1 FROM "BranchMessage" WHERE "conversationId" = $1 AND "senderUserId" = $2 LIMIT 1',
        conversation.id, normalized.id,
      );
      if (sent.length) return true;
      throw new ForbiddenException('This role conversation is visible only to its target role and participating sender');
    }
    const membership = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT 1 FROM "BranchMessageMember" WHERE "conversationId" = $1 AND "userId" = $2 LIMIT 1',
      conversation.id, normalized.id,
    );
    if (!membership.length) throw new ForbiddenException('Only members of this branch group can read or reply');
    return true;
  }

  async getConversation(actor: MessageActor, conversationId: string) {
    const conversation = await this.loadConversation(conversationId);
    await this.assertConversationVisible(actor, conversation);
    await this.markRead(actor, conversationId);
    const messages = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT m."id", m."body", m."createdAt", m."senderUserId", ' +
      'u."firstName" AS "senderFirstName", u."lastName" AS "senderLastName", u."role" AS "senderRole", s."staffId" AS "staffNumber" ' +
      'FROM "BranchMessage" m LEFT JOIN "User" u ON u."id" = m."senderUserId" ' +
      'LEFT JOIN "Staff" s ON s."id" = m."senderStaffId" WHERE m."conversationId" = $1 ' +
      'ORDER BY m."createdAt" DESC LIMIT 100',
      conversationId,
    );
    const normalized = this.normalizeActor(actor);
    return {
      conversation,
      messages: messages.reverse().map((message) => ({
        ...message,
        isMine: String(message.senderUserId) === normalized.id,
      })),
    };
  }

  async markRead(actor: MessageActor, conversationId: string) {
    const conversation = await this.loadConversation(conversationId);
    await this.assertConversationVisible(actor, conversation);
    const normalized = this.normalizeActor(actor);
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "BranchMessageReadState" ("conversationId", "userId", "lastReadAt") ' +
      'VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT ("conversationId", "userId") ' +
      'DO UPDATE SET "lastReadAt" = GREATEST("BranchMessageReadState"."lastReadAt", EXCLUDED."lastReadAt")',
      conversationId, normalized.id,
    );
    return { ok: true, conversationId, readAt: new Date().toISOString() };
  }

  private async insertMessage(tx: any, conversationId: string, actor: any, staffId: string | null, body: string) {
    const id = randomUUID();
    const rows = await tx.$queryRawUnsafe(
      'INSERT INTO "BranchMessage" ("id", "conversationId", "senderUserId", "senderStaffId", "body", "createdAt") ' +
      'VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) ' +
      'RETURNING "id", "conversationId", "senderUserId", "senderStaffId", "body", "createdAt"',
      id, conversationId, actor.id, staffId, body,
    ) as any[];
    await tx.$executeRawUnsafe(
      'UPDATE "BranchMessageConversation" SET "lastMessageAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1',
      conversationId,
    );
    return rows[0];
  }

  async sendToRole(actor: MessageActor, input: { branchId: string; roleTarget: string; message: string }) {
    const result = await this.scopeFor(actor);
    const branchId = await this.assertBranch(result.actor, input?.branchId);
    const roleTarget = String(input?.roleTarget || '').trim().toUpperCase();
    if (!ROLE_CHANNEL_TARGETS.has(roleTarget)) throw new BadRequestException('Choose a valid branch role as the message recipient');
    const body = this.validateMessage(input?.message);
    const linkedRole = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT COUNT(DISTINCT s."id")::int AS "count" FROM "Staff" s ' +
      'LEFT JOIN LATERAL (SELECT u."id", u."role" FROM "User" u ' +
      'WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'WHERE s."employmentStatus" = \'ACTIVE\' AND (' +
      '(s."branchId" = $1 AND u."role"::text = $2) OR EXISTS (' +
      'SELECT 1 FROM "StaffAssignment" a WHERE a."staffId" = s."id" ' +
      'AND a."branchId" = $1 AND a."role"::text = $2 AND a."active" = TRUE ' +
      'AND a."startsAt" <= CURRENT_TIMESTAMP ' +
      'AND (a."endsAt" IS NULL OR a."endsAt" > CURRENT_TIMESTAMP)))',
      branchId, roleTarget,
    );
    if (Number(linkedRole[0]?.count || 0) < 1) {
      throw new BadRequestException('The selected role has no active staff member connected to this branch');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'INSERT INTO "BranchMessageConversation" ("id", "branchId", "type", "roleTarget", "createdByUserId", "createdByStaffId", "createdAt", "updatedAt") ' +
      'VALUES ($1, $2, \'ROLE\', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT ("branchId", "roleTarget") WHERE "type" = \'ROLE\' ' +
      'DO UPDATE SET "updatedAt" = CURRENT_TIMESTAMP RETURNING "id"',
      randomUUID(), branchId, roleTarget, result.actor.id, result.scope.staffId ?? null,
    );
    const id = String(rows[0].id);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "BranchMessageConversation" WHERE "id" = $1 FOR UPDATE', id);
      await this.insertMessage(tx, id, result.actor, result.scope.staffId ?? null, body);
    });
    return this.getConversation(result.actor, id);
  }

  async sendMessage(actor: MessageActor, conversationId: string, message: string) {
    const result = await this.scopeFor(actor);
    const body = this.validateMessage(message);
    const conversation = await this.loadConversation(conversationId);
    await this.assertConversationVisible(result.actor, conversation);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "BranchMessageConversation" WHERE "id" = $1 FOR UPDATE', conversationId);
      await this.insertMessage(tx, conversationId, result.actor, result.scope.staffId ?? null, body);
    });
    return this.getConversation(result.actor, conversationId);
  }

  async createGroup(actor: MessageActor, input: { branchId: string; title: string; staffIds: string[]; message?: string }) {
    const result = await this.scopeFor(actor);
    const branchId = await this.assertBranch(result.actor, input?.branchId);
    if (!result.scope.staffId && !this.isAdmin(result.actor)) {
      throw new ForbiddenException('A linked branch staff account is required to create a staff group');
    }
    const title = String(input?.title || '').trim();
    if (title.length < 2 || title.length > 80) throw new BadRequestException('Group name must be between 2 and 80 characters');
    const selectedIds = [...new Set((Array.isArray(input?.staffIds) ? input.staffIds : []).map((id) => String(id).trim()).filter(Boolean))]
      .filter((id) => id !== String(result.scope.staffId));
    if (selectedIds.length < 2) throw new BadRequestException('A group chat must include at least two other staff members');
    if (selectedIds.length > 49) throw new BadRequestException('A group can contain no more than 50 staff members including its creator');

    const members = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT DISTINCT ON (s."id") s."id" AS "staffId", u."id" AS "userId", ' +
      's."firstName", s."lastName", COALESCE(sa."role"::text, u."role"::text) AS "role" ' +
      'FROM "Staff" s JOIN LATERAL (SELECT u."id", u."role" FROM "User" u ' +
      'WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'LEFT JOIN LATERAL (SELECT a."role" FROM "StaffAssignment" a ' +
      'WHERE a."staffId" = s."id" AND a."branchId" = $2 AND a."active" = TRUE ' +
      'AND a."startsAt" <= CURRENT_TIMESTAMP AND (a."endsAt" IS NULL OR a."endsAt" > CURRENT_TIMESTAMP) ' +
      'ORDER BY a."startsAt" DESC, a."updatedAt" DESC LIMIT 1) sa ON TRUE ' +
      'WHERE s."id" = ANY($1::text[]) AND s."employmentStatus" = \'ACTIVE\' ' +
      'AND (s."branchId" = $2 OR sa."role" IS NOT NULL) ' +
      'ORDER BY s."id"',
      selectedIds, branchId,
    );
    if (members.length !== selectedIds.length) {
      throw new BadRequestException('Every group member must be an active staff account connected to the selected branch');
    }
    const userIds = members.map((member) => String(member.userId));
    if (new Set(userIds).size !== userIds.length || userIds.includes(result.actor.id)) {
      throw new BadRequestException('Group members must be distinct active staff accounts');
    }

    const conversationId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'INSERT INTO "BranchMessageConversation" ("id", "branchId", "type", "title", "createdByUserId", "createdByStaffId", "createdAt", "updatedAt") ' +
        'VALUES ($1, $2, \'GROUP\', $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
        conversationId, branchId, title, result.actor.id, result.scope.staffId,
      );
      await tx.$executeRawUnsafe(
        'INSERT INTO "BranchMessageMember" ("id", "conversationId", "userId", "staffId", "joinedAt") ' +
        'VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
        randomUUID(), conversationId, result.actor.id, result.scope.staffId,
      );
      for (const member of members) {
        await tx.$executeRawUnsafe(
          'INSERT INTO "BranchMessageMember" ("id", "conversationId", "userId", "staffId", "joinedAt") ' +
          'VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)',
          randomUUID(), conversationId, member.userId, member.staffId,
        );
      }
      const opening = String(input?.message || '').trim();
      if (opening) await this.insertMessage(tx, conversationId, result.actor, result.scope.staffId, this.validateMessage(opening));
    });
    return this.getConversation(result.actor, conversationId);
  }
}
