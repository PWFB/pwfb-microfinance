import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma, WorkItemPriority, WorkItemStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Actor = { id: string };
export type WorkItemInput = {
  title?: string; description?: string; category?: string; status?: string; priority?: string;
  tags?: string[]; sessionKey?: string; environment?: string; branch?: string; commitSha?: string;
  pullRequestUrl?: string; deploymentUrl?: string; evidenceUrl?: string; verificationSummary?: string; note?: string;
};
export type WorkItemQuery = {
  q?: string; status?: string; category?: string; sessionKey?: string; includeCompleted?: boolean;
  page?: number; limit?: number;
};

const OPEN_STATUSES: WorkItemStatus[] = [
  WorkItemStatus.TODO, WorkItemStatus.IN_PROGRESS, WorkItemStatus.BLOCKED, WorkItemStatus.UNVERIFIED,
];

@Injectable()
export class WorkLogService {
  constructor(private readonly prisma: PrismaService) {}

  private localDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}${values.month}${values.day}`;
  }

  private reference() {
    return 'PWFB-WORK-' + this.localDateKey() + '-' + randomBytes(8).toString('hex').toUpperCase();
  }

  private sessionKey() {
    const configured = process.env.PWFB_WORK_SESSION_KEY?.trim();
    if (configured) return configured.slice(0, 80);
    return 'PWFB-SESSION-' + this.localDateKey();
  }

  private cleanText(value: unknown, label: string, max: number, required = false): string | undefined {
    if (value === undefined || value === null) {
      if (required) throw new BadRequestException(label + ' is required.');
      return undefined;
    }
    if (typeof value !== 'string') throw new BadRequestException(label + ' must be text.');
    const clean = value.trim();
    if (required && !clean) throw new BadRequestException(label + ' is required.');
    if (clean.length > max) throw new BadRequestException(label + ' must be ' + max + ' characters or fewer.');
    return clean || undefined;
  }

  private url(value: unknown, label: string): string | undefined {
    const clean = this.cleanText(value, label, 1000);
    if (!clean) return undefined;
    try {
      const parsed = new URL(clean);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('invalid scheme');
    } catch {
      throw new BadRequestException(label + ' must be a valid HTTP or HTTPS URL.');
    }
    return clean;
  }

  private status(value: unknown): WorkItemStatus {
    const clean = this.cleanText(value, 'status', 30, true)!.toUpperCase();
    if (!Object.values(WorkItemStatus).includes(clean as WorkItemStatus)) {
      throw new BadRequestException('Status must be TODO, IN_PROGRESS, BLOCKED, UNVERIFIED or COMPLETED.');
    }
    return clean as WorkItemStatus;
  }

  private priority(value: unknown): WorkItemPriority {
    const clean = this.cleanText(value, 'priority', 20, true)!.toUpperCase();
    if (!Object.values(WorkItemPriority).includes(clean as WorkItemPriority)) {
      throw new BadRequestException('Priority must be LOW, NORMAL, HIGH or CRITICAL.');
    }
    return clean as WorkItemPriority;
  }

  private tags(value: unknown): string[] | undefined {
    if (value === undefined) return undefined;
    if (!Array.isArray(value) || value.length > 20 || value.some((tag) => typeof tag !== 'string')) {
      throw new BadRequestException('tags must be an array of up to 20 text labels.');
    }
    return [...new Set(value.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
  }

  private completionEvidence(input: {
    verificationSummary?: string | null; commitSha?: string | null; pullRequestUrl?: string | null;
    deploymentUrl?: string | null; evidenceUrl?: string | null;
  }) {
    if (!input.verificationSummary?.trim()) {
      throw new BadRequestException('A verificationSummary is required before marking work COMPLETED.');
    }
    if (!input.commitSha && !input.pullRequestUrl && !input.deploymentUrl && !input.evidenceUrl) {
      throw new BadRequestException('Add a commit SHA, pull request URL, deployment URL or evidence URL before marking work COMPLETED.');
    }
  }

  async create(input: WorkItemInput, actor: Actor) {
    const title = this.cleanText(input.title, 'title', 180, true)!;
    const status = input.status ? this.status(input.status) : WorkItemStatus.TODO;
    const priority = input.priority ? this.priority(input.priority) : WorkItemPriority.NORMAL;
    const data = {
      reference: this.reference(),
      sessionKey: this.cleanText(input.sessionKey, 'sessionKey', 80) || this.sessionKey(),
      title,
      description: this.cleanText(input.description, 'description', 8000),
      category: (this.cleanText(input.category, 'category', 60) || 'GENERAL').toUpperCase(),
      status,
      priority,
      tags: this.tags(input.tags) || [],
      environment: this.cleanText(input.environment, 'environment', 40),
      branch: this.cleanText(input.branch, 'branch', 160),
      commitSha: this.cleanText(input.commitSha, 'commitSha', 64),
      pullRequestUrl: this.url(input.pullRequestUrl, 'pullRequestUrl'),
      deploymentUrl: this.url(input.deploymentUrl, 'deploymentUrl'),
      evidenceUrl: this.url(input.evidenceUrl, 'evidenceUrl'),
      verificationSummary: this.cleanText(input.verificationSummary, 'verificationSummary', 2000),
      createdByUserId: actor.id,
      completedAt: status === WorkItemStatus.COMPLETED ? new Date() : null,
    };
    if (status === WorkItemStatus.COMPLETED) this.completionEvidence(data);
    const note = this.cleanText(input.note, 'note', 2000);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.workItem.create({ data });
      await tx.workItemEvent.create({
        data: {
          workItemId: item.id, actorUserId: actor.id, eventType: 'CREATED',
          toStatus: item.status, note: note || 'Work item recorded.',
          changes: { reference: item.reference, sessionKey: item.sessionKey, category: item.category, priority: item.priority },
        },
      });
      return tx.workItem.findUnique({
        where: { id: item.id },
        include: { createdBy: { select: { id: true, publicUserId: true, firstName: true, lastName: true } }, assignedTo: { select: { id: true, publicUserId: true, firstName: true, lastName: true } }, events: { orderBy: { createdAt: 'asc' } } },
      });
    });
  }

  async list(query: WorkItemQuery) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 25)));
    const where: Prisma.WorkItemWhereInput = {};
    const q = query.q?.trim();
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { sessionKey: { contains: q, mode: 'insensitive' } },
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { branch: { contains: q, mode: 'insensitive' } },
        { commitSha: { contains: q, mode: 'insensitive' } },
        { tags: { hasSome: [q.toLowerCase()] } },
      ];
    }
    if (query.status) {
      const status = query.status.trim().toUpperCase();
      if (status === 'OPEN' || status === 'UNCOMPLETED') where.status = { in: OPEN_STATUSES };
      else where.status = this.status(status);
    } else if (!query.includeCompleted) {
      where.status = { in: OPEN_STATUSES };
    }
    if (query.category?.trim()) where.category = { equals: query.category.trim(), mode: 'insensitive' };
    if (query.sessionKey?.trim()) where.sessionKey = { equals: query.sessionKey.trim(), mode: 'insensitive' };
    const [total, data] = await this.prisma.$transaction([
      this.prisma.workItem.count({ where }),
      this.prisma.workItem.findMany({
        where, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
        include: { createdBy: { select: { id: true, publicUserId: true, firstName: true, lastName: true } }, assignedTo: { select: { id: true, publicUserId: true, firstName: true, lastName: true } } },
      }),
    ]);
    return { data, filters: { q: q || null, status: query.status || (query.includeCompleted ? 'ALL' : 'OPEN'), category: query.category || null, sessionKey: query.sessionKey || null }, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async summary() {
    const groups = await this.prisma.workItem.groupBy({ by: ['status'], _count: { _all: true } });
    const counts: Record<string, number> = {
      TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, UNVERIFIED: 0, COMPLETED: 0, TOTAL: 0, OPEN: 0,
    };
    for (const group of groups) {
      counts[group.status] = group._count._all;
      counts.TOTAL += group._count._all;
      if (group.status !== WorkItemStatus.COMPLETED) counts.OPEN += group._count._all;
    }
    return counts;
  }

  async get(reference: string) {
    const item = await this.prisma.workItem.findUnique({
      where: { reference },
      include: {
        createdBy: { select: { id: true, publicUserId: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, publicUserId: true, firstName: true, lastName: true } },
        events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { id: true, publicUserId: true, firstName: true, lastName: true } } } },
      },
    });
    if (!item) throw new NotFoundException('Work item not found.');
    return item;
  }

  async update(reference: string, input: WorkItemInput, actor: Actor) {
    const current = await this.prisma.workItem.findUnique({ where: { reference } });
    if (!current) throw new NotFoundException('Work item not found.');
    const data: Prisma.WorkItemUpdateInput = {};
    const changeLog: Record<string, unknown> = {};
    const assignText = (field: keyof WorkItemInput, label: string, max: number) => {
      if (input[field] === undefined) return;
      const value = this.cleanText(input[field], label, max);
      (data as any)[field] = value ?? null;
      changeLog[field] = value ?? null;
    };
    if (input.title !== undefined) { data.title = this.cleanText(input.title, 'title', 180, true)!; changeLog.title = data.title; }
    assignText('description', 'description', 8000);
    assignText('environment', 'environment', 40);
    assignText('branch', 'branch', 160);
    assignText('commitSha', 'commitSha', 64);
    assignText('verificationSummary', 'verificationSummary', 2000);
    if (input.category !== undefined) { data.category = (this.cleanText(input.category, 'category', 60) || 'GENERAL').toUpperCase(); changeLog.category = data.category; }
    if (input.priority !== undefined) { data.priority = this.priority(input.priority); changeLog.priority = data.priority; }
    if (input.tags !== undefined) { data.tags = this.tags(input.tags)!; changeLog.tags = data.tags; }
    if (input.sessionKey !== undefined) { data.sessionKey = this.cleanText(input.sessionKey, 'sessionKey', 80) || current.sessionKey; changeLog.sessionKey = data.sessionKey; }
    if (input.pullRequestUrl !== undefined) { data.pullRequestUrl = this.url(input.pullRequestUrl, 'pullRequestUrl') ?? null; changeLog.pullRequestUrl = data.pullRequestUrl; }
    if (input.deploymentUrl !== undefined) { data.deploymentUrl = this.url(input.deploymentUrl, 'deploymentUrl') ?? null; changeLog.deploymentUrl = data.deploymentUrl; }
    if (input.evidenceUrl !== undefined) { data.evidenceUrl = this.url(input.evidenceUrl, 'evidenceUrl') ?? null; changeLog.evidenceUrl = data.evidenceUrl; }
    const nextStatus = input.status !== undefined ? this.status(input.status) : current.status;
    const note = this.cleanText(input.note, 'note', 2000);
    if (input.status !== undefined) { data.status = nextStatus; changeLog.status = nextStatus; }
    const verificationSummary = (data as any).verificationSummary !== undefined ? (data as any).verificationSummary : current.verificationSummary;
    const evidence = {
      verificationSummary,
      commitSha: (data as any).commitSha !== undefined ? (data as any).commitSha : current.commitSha,
      pullRequestUrl: (data as any).pullRequestUrl !== undefined ? (data as any).pullRequestUrl : current.pullRequestUrl,
      deploymentUrl: (data as any).deploymentUrl !== undefined ? (data as any).deploymentUrl : current.deploymentUrl,
      evidenceUrl: (data as any).evidenceUrl !== undefined ? (data as any).evidenceUrl : current.evidenceUrl,
    };
    if (nextStatus === WorkItemStatus.COMPLETED) this.completionEvidence(evidence);
    if (current.status === WorkItemStatus.COMPLETED && nextStatus !== WorkItemStatus.COMPLETED && !note) {
      throw new BadRequestException('Add a note explaining why completed work is being reopened.');
    }
    if (nextStatus !== current.status) data.completedAt = nextStatus === WorkItemStatus.COMPLETED ? new Date() : null;
    if (Object.keys(changeLog).length === 0 && !note) throw new BadRequestException('Provide at least one field to update or a note.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.workItem.update({ where: { id: current.id }, data });
      await tx.workItemEvent.create({
        data: {
          workItemId: current.id, actorUserId: actor.id,
          eventType: nextStatus !== current.status ? 'STATUS_CHANGED' : Object.keys(changeLog).length ? 'UPDATED' : 'NOTE_ADDED',
          fromStatus: current.status, toStatus: nextStatus, note: note || null,
          changes: changeLog as Prisma.InputJsonValue,
        },
      });
      return tx.workItem.findUnique({ where: { id: item.id }, include: { events: { orderBy: { createdAt: 'asc' } } } });
    });
  }
}
