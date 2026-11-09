import { createHmac, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

type CallActor = { id: string; role: string; staffId?: string; customerId?: string };
const STAFF_ROLES = new Set([
  'SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER',
  'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER',
  'LOAN_OFFICER', 'AUDITOR', 'MONITORING_TEAM', 'STAFF',
]);
const ACTIVE_CALL_STATUSES = ['RINGING', 'ACCEPTED'];

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private actor(input: CallActor) {
    const id = String(input?.id || '').trim();
    const role = String(input?.role || '').trim().toUpperCase();
    if (!id || !role) throw new ForbiddenException('An authenticated PWFB account is required');
    if (role !== 'CUSTOMER' && !STAFF_ROLES.has(role)) throw new ForbiddenException('This account is not permitted to use PWFB calling');
    return {
      id,
      role,
      ...(input.staffId ? { staffId: String(input.staffId) } : {}),
      ...(input.customerId ? { customerId: String(input.customerId) } : {}),
    };
  }

  private async staffScope(actor: CallActor) {
    const normalized = this.actor(actor);
    if (normalized.role === 'CUSTOMER') throw new ForbiddenException('Customer accounts cannot start staff or client calls');
    const scope = await this.accessScope.getScope(normalized);
    if (normalized.role !== 'SUPER_ADMIN' && !scope.staffId) {
      throw new ForbiddenException('Your staff login must be linked to an active PWFB staff record');
    }
    return { actor: normalized, scope };
  }

  private async branchIds(actor: CallActor) {
    const scope = await this.accessScope.getScope(actor);
    if (scope.global) {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Branch" ORDER BY "name" ASC');
      return rows.map((row) => String(row.id));
    }
    return (await this.accessScope.getScopedBranchIds(actor) || []).map(String);
  }

  private buildIceServers(userId: string) {
    const servers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    const turnUrls = String(process.env.PWFB_TURN_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
    const sharedSecret = String(process.env.PWFB_TURN_SHARED_SECRET || '').trim();
    if (turnUrls.length && sharedSecret) {
      const expiry = Math.floor(Date.now() / 1000) + 3600;
      const username = expiry + ':' + userId;
      const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');
      servers.push({ urls: turnUrls, username, credential });
    }
    return servers;
  }

  async getContext(actor: CallActor) {
    const normalized = this.actor(actor);
    if (normalized.role === 'CUSTOMER') {
      const customerId = String(normalized.customerId || '').trim();
      if (!customerId) throw new ForbiddenException('Your login is not linked to a customer profile');
      const rows = await this.prisma.$queryRawUnsafe<any[]>(
        'SELECT c."id", c."branchId", c."phone", COALESCE(p."enabled", FALSE) AS "callEnabled", p."consentAt" ' +
        'FROM "Customer" c LEFT JOIN "CustomerCallPreference" p ON p."customerId" = c."id" WHERE c."id" = $1 LIMIT 1',
        customerId,
      );
      if (!rows[0]) throw new NotFoundException('Customer profile not found');
      return {
        userRole: normalized.role,
        currentUserId: normalized.id,
        customerId,
        branchId: rows[0].branchId,
        phone: rows[0].phone,
        callEnabled: Boolean(rows[0].callEnabled),
        consentAt: rows[0].consentAt,
        iceServers: this.buildIceServers(normalized.id),
      };
    }

    const result = await this.staffScope(normalized);
    const ids = await this.branchIds(result.actor);
    const branches = ids.length
      ? await this.prisma.$queryRawUnsafe<any[]>(
          'SELECT "id", "name" FROM "Branch" WHERE "id" = ANY($1::text[]) ORDER BY "name" ASC',
          ids,
        )
      : [];
    return {
      userRole: normalized.role,
      currentUserId: normalized.id,
      currentBranchId: result.scope.branchId || (branches.length === 1 ? branches[0].id : null),
      branches,
      canCallStaff: true,
      canCallClients: true,
      iceServers: this.buildIceServers(normalized.id),
    };
  }

  async getContacts(actor: CallActor, branchId: string, search?: string) {
    const result = await this.staffScope(actor);
    const id = String(branchId || '').trim();
    if (!id) throw new BadRequestException('Choose a branch to load client contacts');
    await this.accessScope.assertBranch(result.actor, id);
    const term = String(search || '').trim();
    const like = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';

    // Internal staff voice calls are organisation-wide. The directory only
    // exposes each active staff account's name, role and branch (not phone
    // numbers), and every row must be connected to an active staff profile.
    const staff = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT DISTINCT ON (s."id") s."id" AS "staffId", u."id" AS "userId", ' +
      's."firstName", s."lastName", s."position", u."role", b."name" AS "branchName" ' +
      'FROM "Staff" s JOIN LATERAL (SELECT u."id", u."role" FROM "User" u ' +
      'WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'LEFT JOIN "Branch" b ON b."id" = s."branchId" ' +
      'WHERE s."employmentStatus" = \'ACTIVE\' AND u."role" <> \'CUSTOMER\' AND u."id" <> $1 ' +
      'AND ($2 = \'%%\' OR s."firstName" ILIKE $2 OR s."lastName" ILIKE $2 OR u."role"::text ILIKE $2 OR b."name" ILIKE $2) ' +
      'ORDER BY s."id", s."firstName", s."lastName"',
      result.actor.id, like,
    );

    // Client calls remain branch-bound and require explicit client opt-in.
    const creditOfficerOnly = result.actor.role === 'CREDIT_OFFICER' ? ' AND c."assignedStaffId" = $3' : '';
    const clientParams = result.actor.role === 'CREDIT_OFFICER'
      ? [id, like, result.scope.staffId]
      : [id, like];
    const clients = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT DISTINCT ON (c."id") c."id" AS "customerId", u."id" AS "userId", ' +
      'c."firstName", c."lastName", c."phone", COALESCE(p."enabled", FALSE) AS "callEnabled" ' +
      'FROM "Customer" c LEFT JOIN LATERAL (SELECT u."id" FROM "User" u ' +
      'WHERE u."id" = c."userId" OR u."customerId" = c."id" ORDER BY CASE WHEN u."id" = c."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'LEFT JOIN "CustomerCallPreference" p ON p."customerId" = c."id" ' +
      'WHERE c."branchId" = $1 AND c."phone" IS NOT NULL AND BTRIM(c."phone") <> \'\'' + creditOfficerOnly + ' ' +
      'AND ($2 = \'%%\' OR c."firstName" ILIKE $2 OR c."lastName" ILIKE $2 OR c."phone" ILIKE $2) ' +
      'ORDER BY c."id", c."firstName", c."lastName"',
      ...clientParams,
    );
    return {
      branchId: id,
      staff: staff.map((person) => ({
        ...person,
        name: [person.firstName, person.lastName].filter(Boolean).join(' '),
        callAvailable: true,
      })),
      clients: clients.map((client) => ({
        ...client,
        name: [client.firstName, client.lastName].filter(Boolean).join(' '),
        callAvailable: Boolean(client.callEnabled),
      })),
    };
  }

  async setClientCallPermission(actor: CallActor, enabled: boolean) {
    const normalized = this.actor(actor);
    if (normalized.role !== 'CUSTOMER') throw new ForbiddenException('Only a client can change their own call permission');
    if (typeof enabled !== 'boolean') throw new BadRequestException('Call permission must be true or false');
    const customerId = String(normalized.customerId || '').trim();
    if (!customerId) throw new ForbiddenException('Your login is not linked to a customer profile');
    const owned = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT c."id", c."phone" FROM "Customer" c JOIN "User" u ON (u."id" = c."userId" OR u."customerId" = c."id") ' +
      'WHERE c."id" = $1 AND u."id" = $2 LIMIT 1',
      customerId, normalized.id,
    );
    if (!owned.length) throw new ForbiddenException('The signed-in customer account does not match this customer profile');
    if (enabled && !String(owned[0].phone || '').trim()) {
      throw new ConflictException('Add a valid phone number to your PWFB customer profile before enabling calls');
    }
    const preference = await this.prisma.$queryRawUnsafe<any[]>(
      'INSERT INTO "CustomerCallPreference" ("id", "customerId", "enabled", "consentAt", "consentVersion", "updatedAt") ' +
      'VALUES ($1, $2, $3, CASE WHEN $3 THEN CURRENT_TIMESTAMP ELSE NULL END, \'2026-11-09-v1\', CURRENT_TIMESTAMP) ' +
      'ON CONFLICT ("customerId") DO UPDATE SET "enabled" = EXCLUDED."enabled", ' +
      '"consentAt" = CASE WHEN EXCLUDED."enabled" THEN CURRENT_TIMESTAMP ELSE NULL END, ' +
      '"consentVersion" = EXCLUDED."consentVersion", "updatedAt" = CURRENT_TIMESTAMP RETURNING "customerId", "enabled", "consentAt"',
      randomUUID(), customerId, enabled,
    );
    if (!enabled) {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "CallSession" SET "status" = \'ENDED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
        'WHERE "customerId" = $1 AND "status" IN (\'RINGING\', \'ACCEPTED\') AND "recipientUserId" = $2',
        customerId, normalized.id,
      );
    }
    return { ok: true, preference: preference[0] };
  }

  async startStaffCall(actor: CallActor, targetStaffId: string) {
    const result = await this.staffScope(actor);
    const id = String(targetStaffId || '').trim();
    if (!id || id === result.scope.staffId) throw new BadRequestException('Choose another staff member to call');
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT s."id" AS "staffId", s."branchId", u."id" AS "userId" FROM "Staff" s ' +
      'JOIN LATERAL (SELECT u."id" FROM "User" u WHERE u."id" = s."userId" OR u."staffId" = s."id" ' +
      'ORDER BY CASE WHEN u."id" = s."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'WHERE s."id" = $1 AND s."employmentStatus" = \'ACTIVE\' LIMIT 1',
      id,
    );
    if (!rows[0]) throw new NotFoundException('Active linked staff member not found');
    if (String(rows[0].userId) === result.actor.id) throw new BadRequestException('You cannot call your own account');
    const branchId = String(rows[0].branchId || result.scope.branchId || '').trim();
    if (!branchId) throw new ConflictException('This staff member has no branch context for call routing');
    return this.createSession({
      type: 'STAFF',
      branchId,
      callerUserId: result.actor.id,
      callerStaffId: result.scope.staffId ?? null,
      recipientUserId: String(rows[0].userId),
      recipientStaffId: String(rows[0].staffId),
      customerId: null,
    });
  }

  async startClientCall(actor: CallActor, targetCustomerId: string) {
    const result = await this.staffScope(actor);
    const customerId = String(targetCustomerId || '').trim();
    if (!customerId) throw new BadRequestException('Choose a client to call');
    await this.accessScope.assertCustomer(result.actor, customerId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT c."id", c."branchId", c."phone", u."id" AS "userId", COALESCE(p."enabled", FALSE) AS "callEnabled" ' +
      'FROM "Customer" c JOIN LATERAL (SELECT u."id" FROM "User" u ' +
      'WHERE u."id" = c."userId" OR u."customerId" = c."id" ORDER BY CASE WHEN u."id" = c."userId" THEN 0 ELSE 1 END LIMIT 1) u ON TRUE ' +
      'LEFT JOIN "CustomerCallPreference" p ON p."customerId" = c."id" WHERE c."id" = $1 LIMIT 1',
      customerId,
    );
    if (!rows[0]) throw new NotFoundException('Client does not have a PWFB application login linked to this profile');
    if (!String(rows[0].phone || '').trim()) throw new ConflictException('This client has no phone number registered on the PWFB profile');
    if (!rows[0].callEnabled) throw new ForbiddenException('The client has not enabled staff voice calls in the PWFB client application');
    if (String(rows[0].userId) === result.actor.id) throw new BadRequestException('You cannot call your own account');
    const branchId = String(rows[0].branchId || '');
    if (!branchId) throw new ConflictException('The client is not assigned to a branch');
    return this.createSession({
      type: 'CLIENT',
      branchId,
      callerUserId: result.actor.id,
      callerStaffId: result.scope.staffId ?? null,
      recipientUserId: String(rows[0].userId),
      recipientStaffId: null,
      customerId,
    });
  }

  private async createSession(input: {
    type: 'STAFF' | 'CLIENT';
    branchId: string;
    callerUserId: string;
    callerStaffId: string | null;
    recipientUserId: string;
    recipientStaffId: string | null;
    customerId: string | null;
  }) {
    const id = randomUUID();
    const call = await this.prisma.$transaction(async (tx) => {
      // The same sorted participant locks prevent simultaneous outgoing and
      // incoming calls from creating multiple active sessions for one user.
      for (const userId of [input.callerUserId, input.recipientUserId].sort()) {
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          'PWFB-CALL-USER:' + userId,
        );
      }
      await tx.$executeRawUnsafe(
        'UPDATE "CallSession" SET "status" = \'MISSED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
        'WHERE "status" = \'RINGING\' AND "expiresAt" < CURRENT_TIMESTAMP',
      );
      await tx.$executeRawUnsafe(
        'UPDATE "CallSession" SET "status" = \'ENDED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
        'WHERE "status" = \'ACCEPTED\' AND "lastHeartbeatAt" < CURRENT_TIMESTAMP - INTERVAL \'90 seconds\'',
      );
      const busy = await tx.$queryRawUnsafe<any[]>(
        'SELECT "id" FROM "CallSession" WHERE "status" IN (\'RINGING\', \'ACCEPTED\') ' +
        'AND ("callerUserId" IN ($1, $2) OR "recipientUserId" IN ($1, $2)) LIMIT 1',
        input.callerUserId, input.recipientUserId,
      );
      if (busy.length) throw new ConflictException('One of these PWFB accounts is already on another call');
      const rows = await tx.$queryRawUnsafe<any[]>(
        'INSERT INTO "CallSession" ("id", "type", "branchId", "callerUserId", "callerStaffId", "recipientUserId", "recipientStaffId", "customerId", "status", "initiatedAt", "expiresAt", "createdAt", "updatedAt") ' +
        'VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \'RINGING\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL \'45 seconds\', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ' +
        'RETURNING "id", "type", "branchId", "callerUserId", "recipientUserId", "status", "expiresAt", "createdAt"',
        id, input.type, input.branchId, input.callerUserId, input.callerStaffId,
        input.recipientUserId, input.recipientStaffId, input.customerId,
      );
      return rows[0];
    });
    return { ok: true, call: { ...call, direction: 'OUTGOING' } };
  }

  async listCalls(actor: CallActor) {
    const normalized = this.actor(actor);
    await this.expireRingingCalls();
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CallSession" SET "status" = \'ENDED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "status" = \'ACCEPTED\' AND "lastHeartbeatAt" < CURRENT_TIMESTAMP - INTERVAL \'90 seconds\'',
    );
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CallSession" SET "lastHeartbeatAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "status" IN (\'RINGING\', \'ACCEPTED\') AND ("callerUserId" = $1 OR "recipientUserId" = $1)',
      normalized.id,
    );
    if (normalized.role !== 'CUSTOMER') await this.staffScope(normalized);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT c."id", c."type", c."branchId", b."name" AS "branchName", c."callerUserId", ' +
      'c."recipientUserId", c."customerId", c."status", c."initiatedAt", c."expiresAt", c."acceptedAt", c."endedAt", ' +
      'cu."firstName" AS "callerFirstName", cu."lastName" AS "callerLastName", cu."role" AS "callerRole", ' +
      'ru."firstName" AS "recipientFirstName", ru."lastName" AS "recipientLastName", ru."role" AS "recipientRole", ' +
      'CASE WHEN c."callerUserId" = $1 THEN \'OUTGOING\' ELSE \'INCOMING\' END AS "direction" ' +
      'FROM "CallSession" c JOIN "Branch" b ON b."id" = c."branchId" ' +
      'JOIN "User" cu ON cu."id" = c."callerUserId" JOIN "User" ru ON ru."id" = c."recipientUserId" ' +
      'WHERE (c."callerUserId" = $1 OR c."recipientUserId" = $1) ' +
      'AND c."createdAt" > CURRENT_TIMESTAMP - INTERVAL \'7 days\' ' +
      'ORDER BY c."createdAt" DESC LIMIT 50',
      normalized.id,
    );
    return rows;
  }

  private async expireRingingCalls() {
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CallSession" SET "status" = \'MISSED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "status" = \'RINGING\' AND "expiresAt" < CURRENT_TIMESTAMP',
    );
  }

  private async loadCall(id: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT * FROM "CallSession" WHERE "id" = $1 LIMIT 1',
      String(id || '').trim(),
    );
    if (!rows[0]) throw new NotFoundException('Call session not found');
    return rows[0];
  }

  private async assertParticipant(actor: CallActor, call: any) {
    const normalized = this.actor(actor);
    if (String(call.callerUserId) !== normalized.id && String(call.recipientUserId) !== normalized.id) {
      throw new ForbiddenException('Only the two participants can access this call or its audio signalling');
    }
    if (normalized.role === 'CUSTOMER' && String(call.recipientUserId) !== normalized.id) {
      throw new ForbiddenException('Customer accounts can only receive staff calls');
    }
    if (normalized.role !== 'CUSTOMER' && call.type === 'CLIENT') {
      await this.accessScope.assertBranch(normalized, String(call.branchId));
    }
    return normalized;
  }

  async acceptCall(actor: CallActor, callId: string) {
    const call = await this.loadCall(callId);
    const normalized = await this.assertParticipant(actor, call);
    if (String(call.recipientUserId) !== normalized.id) throw new ForbiddenException('Only the receiving account can accept a call');
    if (String(call.status) !== 'RINGING' || new Date(call.expiresAt).getTime() <= Date.now()) {
      await this.expireRingingCalls();
      throw new ConflictException('This call has expired or is no longer ringing');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'UPDATE "CallSession" SET "status" = \'ACCEPTED\', "acceptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "id" = $1 AND "recipientUserId" = $2 AND "status" = \'RINGING\' AND "expiresAt" > CURRENT_TIMESTAMP ' +
      'RETURNING "id", "type", "branchId", "callerUserId", "recipientUserId", "status", "acceptedAt"',
      callId, normalized.id,
    );
    if (!rows.length) throw new ConflictException('This call was already answered or has expired');
    return { ok: true, call: rows[0] };
  }

  async declineCall(actor: CallActor, callId: string) {
    const call = await this.loadCall(callId);
    const normalized = await this.assertParticipant(actor, call);
    if (String(call.recipientUserId) !== normalized.id) throw new ForbiddenException('Only the receiving account can decline a call');
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CallSession" SET "status" = \'DECLINED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "id" = $1 AND "recipientUserId" = $2 AND "status" = \'RINGING\'',
      callId, normalized.id,
    );
    return { ok: true, callId, status: 'DECLINED' };
  }

  async endCall(actor: CallActor, callId: string) {
    const call = await this.loadCall(callId);
    const normalized = await this.assertParticipant(actor, call);
    await this.prisma.$executeRawUnsafe(
      'UPDATE "CallSession" SET "status" = \'ENDED\', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP ' +
      'WHERE "id" = $1 AND "status" IN (\'RINGING\', \'ACCEPTED\')',
      callId,
    );
    return { ok: true, callId, status: 'ENDED', userId: normalized.id };
  }

  async sendSignal(actor: CallActor, callId: string, kind: string, payload: unknown) {
    const call = await this.loadCall(callId);
    const normalized = await this.assertParticipant(actor, call);
    const signalKind = String(kind || '').trim().toUpperCase();
    if (!['OFFER', 'ANSWER', 'ICE'].includes(signalKind)) throw new BadRequestException('Unsupported call signal');
    const encoded = JSON.stringify(payload ?? null);
    if (!encoded || encoded === 'null' || encoded.length > 24000) throw new BadRequestException('Invalid or oversized WebRTC signalling payload');
    if (signalKind === 'OFFER' && (normalized.id !== String(call.callerUserId) || call.status !== 'ACCEPTED')) {
      throw new ForbiddenException('Only the caller can send an offer after the recipient accepts');
    }
    if (signalKind === 'ANSWER' && (normalized.id !== String(call.recipientUserId) || call.status !== 'ACCEPTED')) {
      throw new ForbiddenException('Only the accepted recipient can send an answer');
    }
    if (signalKind === 'ICE' && call.status !== 'ACCEPTED') throw new ConflictException('ICE candidates can be exchanged after the call is accepted');
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "CallSignal" ("id", "callId", "fromUserId", "kind", "payload", "createdAt") VALUES ($1, $2, $3, $4, $5::jsonb, CURRENT_TIMESTAMP)',
      randomUUID(), callId, normalized.id, signalKind, encoded,
    );
    return { ok: true };
  }

  async getSignals(actor: CallActor, callId: string, after?: string) {
    const call = await this.loadCall(callId);
    const normalized = await this.assertParticipant(actor, call);
    let cursor = 0n;
    if (after) {
      try { cursor = BigInt(after); } catch { throw new BadRequestException('Invalid signalling cursor'); }
      if (cursor < 0n) throw new BadRequestException('Invalid signalling cursor');
    }
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      'SELECT "id", "sequence", "fromUserId", "kind", "payload", "createdAt" FROM "CallSignal" ' +
      'WHERE "callId" = $1 AND "fromUserId" <> $2 AND "sequence" > $3::bigint ORDER BY "sequence" ASC LIMIT 100',
      callId, normalized.id, cursor.toString(),
    );
    return rows.map((row) => ({ ...row, sequence: String(row.sequence) }));
  }
}
