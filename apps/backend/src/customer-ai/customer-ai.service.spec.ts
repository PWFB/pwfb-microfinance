import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CustomerAiService } from './customer-ai.service';

describe('CustomerAiService customer case isolation', () => {
  let service: CustomerAiService;
  let prisma: any;
  const savedApiKey = process.env.OPENAI_API_KEY;
  const savedModel = process.env.BALMZ_AI_MODEL;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-only-key';
    process.env.BALMZ_AI_MODEL = 'test-model';
    prisma = {
      customer: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'PWFB-CUS-0042',
          userId: 'user-42',
          firstName: 'Test',
          lastName: 'Customer',
        }),
      },
      customerAiCase: {
        create: jest.fn().mockResolvedValue({
          id: 'case-42',
          reference: 'PWFB-AI-20261119-ABCDEF123456',
          subject: 'Missing deposit',
          category: 'GENERAL',
          status: 'OPEN',
        }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      customerAiCaseMessage: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          { role: 'user', content: 'Please check my deposit.' },
        ]),
      },
      customerAiCaseAttachment: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new CustomerAiService(prisma);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ output_text: 'I reviewed the information. Your case reference is recorded.' }),
      text: async () => '',
    }) as any;
  });

  afterEach(() => {
    if (savedApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = savedApiKey;
    if (savedModel === undefined) delete process.env.BALMZ_AI_MODEL;
    else process.env.BALMZ_AI_MODEL = savedModel;
    jest.restoreAllMocks();
  });

  it('creates a case under the authenticated customer and sends an attached receipt for review', async () => {
    const receipt = Buffer.from('sample receipt image').toString('base64');
    const result = await service.chat(
      'My deposit is missing from the app.',
      { id: 'user-42', role: 'CUSTOMER', email: 'customer@example.com' },
      undefined,
      [{ fileName: 'receipt.png', mimeType: 'image/png', dataBase64: receipt }],
    );

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'user-42' },
    }));
    expect(prisma.customerAiCase.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'PWFB-CUS-0042', status: 'OPEN' }),
    }));
    expect(prisma.customerAiCaseAttachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        caseId: 'case-42',
        customerId: 'PWFB-CUS-0042',
        fileName: 'receipt.png',
        mimeType: 'image/png',
      }),
    }));
    const providerBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(providerBody.input[0].content.some((part: any) => part.type === 'input_image')).toBe(true);
    expect(result).toMatchObject({
      customerId: 'PWFB-CUS-0042',
      caseId: 'case-42',
      caseReference: 'PWFB-AI-20261119-ABCDEF123456',
      configured: true,
    });
  });

  it('does not allow a customer to open a different customer case', async () => {
    prisma.customerAiCase.findFirst.mockResolvedValue(null);
    await expect(
      service.getCase('another-customer-case', { id: 'user-42', role: 'CUSTOMER' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('does not allow an unlinked account or non-customer role to use customer AI', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(
      service.listCases({ id: 'unlinked-user', role: 'CUSTOMER' }),
    ).rejects.toThrow(UnauthorizedException);
    await expect(
      service.listCases({ id: 'admin-user', role: 'SUPER_ADMIN' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unsupported receipt attachment formats before opening a case', async () => {
    await expect(
      service.chat('Please check this file.', { id: 'user-42', role: 'CUSTOMER' }, undefined, [
        { fileName: 'receipt.txt', mimeType: 'text/plain', dataBase64: Buffer.from('not a receipt').toString('base64') },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.customerAiCase.create).not.toHaveBeenCalled();
  });

  it('returns a customer-owned case list only', async () => {
    prisma.customerAiCase.findMany.mockResolvedValue([]);
    await service.listCases({ id: 'user-42', role: 'CUSTOMER' });
    expect(prisma.customerAiCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'PWFB-CUS-0042' },
    }));
  });
});
