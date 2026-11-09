import { BadRequestException } from '@nestjs/common';
import { WorkLogService } from './work-log.service';

describe('WorkLogService', () => {
  const actor = { id: 'admin-user' };
  let service: WorkLogService;

  beforeEach(() => {
    service = new WorkLogService({} as any);
    delete process.env.PWFB_WORK_SESSION_KEY;
  });

  it('generates stable, searchable reference formats and a daily session key', () => {
    const reference = (service as any).reference();
    const sessionKey = (service as any).sessionKey();
    expect(reference).toMatch(/^PWFB-WORK-\d{8}-[A-F0-9]{16}$/);
    expect(sessionKey).toMatch(/^PWFB-SESSION-\d{8}$/);
  });

  it('uses an explicitly configured session key so several tasks can be grouped', () => {
    process.env.PWFB_WORK_SESSION_KEY = 'PWFB-SESSION-RELEASE-2026-11';
    expect((service as any).sessionKey()).toBe('PWFB-SESSION-RELEASE-2026-11');
  });

  it('does not allow a work item to be marked completed without verification evidence', () => {
    expect(() => (service as any).completionEvidence({ verificationSummary: 'Tests passed' }))
      .toThrow(BadRequestException);
    expect(() => (service as any).completionEvidence({ commitSha: 'abcdef12345678' }))
      .toThrow(BadRequestException);
  });

  it('requires evidence URLs to use HTTP or HTTPS', () => {
    expect(() => (service as any).url('javascript:alert(1)', 'evidenceUrl'))
      .toThrow(BadRequestException);
    expect((service as any).url('https://github.com/PWFB/pwfb-microfinance/pull/107', 'evidenceUrl'))
      .toBe('https://github.com/PWFB/pwfb-microfinance/pull/107');
  });

  it('writes the item and its initial history event in one database transaction', async () => {
    const item = {
      id: 'work-item-1', reference: 'PWFB-WORK-20261109-1234ABCD',
      sessionKey: 'PWFB-SESSION-20261109', title: 'Audit backend cleanup',
      status: 'TODO', priority: 'NORMAL', category: 'BACKEND',
    };
    const tx = {
      workItem: {
        create: jest.fn().mockResolvedValue(item),
        findUnique: jest.fn().mockResolvedValue(item),
      },
      workItemEvent: { create: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback: any) => callback(tx)) };
    service = new WorkLogService(prisma as any);

    const created = await service.create({ title: 'Audit backend cleanup', category: 'backend' }, actor);

    expect(created).toEqual(item);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.workItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Audit backend cleanup', category: 'BACKEND', status: 'TODO' }),
    }));
    expect(tx.workItemEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ workItemId: item.id, actorUserId: actor.id, eventType: 'CREATED' }),
    }));
  });

  it('rejects completion before opening a transaction if evidence is missing', async () => {
    const prisma = { $transaction: jest.fn() };
    service = new WorkLogService(prisma as any);

    await expect(service.create({ title: 'Unverified task', status: 'COMPLETED' }, actor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
