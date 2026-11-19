import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomerAiService } from './customer-ai.service';

describe('CustomerAiService customer isolation and receipt cases', () => {
  let service: CustomerAiService;
  let prisma: any;
  const customer = { id: 'customer-1', firstName: 'Test', lastName: 'Customer', userId: 'user-1' };
  const user = { id: 'user-1', role: 'CUSTOMER', customerId: customer.id, customer };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      customer: { findFirst: jest.fn(), findUnique: jest.fn() },
      customerWallet: { findUnique: jest.fn().mockResolvedValue(null) },
      savings: { findMany: jest.fn().mockResolvedValue([]) },
      walletTransaction: { findMany: jest.fn().mockResolvedValue([]) },
      loan: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };
    service = new CustomerAiService(prisma);
  });

  it('uses the authenticated customer record as the client ID', async () => {
    const result = await service.context({ sub: user.id });
    expect(result.customerId).toBe(customer.id);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: user.id }, include: { customer: true } });
  });

  it('does not allow a Super Admin token to use the customer assistant', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, role: 'SUPER_ADMIN' });
    await expect(service.context({ sub: user.id })).rejects.toThrow(ForbiddenException);
  });

  it('rejects a conversation identifier not owned by the authenticated customer', async () => {
    await expect(service.chat({ sub: user.id }, {
      conversationId: 'f3f91212-7545-4b54-9264-27b5cc2a4fd7',
      message: 'Hello',
    })).rejects.toThrow(NotFoundException);
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('stores a receipt complaint against the authenticated customer and returns a case reference', async () => {
    const pdf = { buffer: Buffer.from('%PDF-1.7 test receipt'), mimetype: 'application/pdf', originalname: 'receipt.pdf' };
    const result = await service.chat({ sub: user.id }, {
      message: 'My deposit is not showing.',
      isComplaint: 'true',
      subject: 'Missing deposit',
    }, pdf);
    expect(result.customerId).toBe(customer.id);
    expect(result.case.reference).toMatch(/^PWFB-CASE-\d{14}-[A-F0-9]{8}$/);
    expect(result.case.status).toBe('OPEN');
    const insert = prisma.$executeRawUnsafe.mock.calls.find((call: any[]) => String(call[0]).includes('INSERT INTO "CustomerAiCase"'));
    expect(insert).toBeDefined();
    expect(insert).toContain(customer.id);
    expect(insert).toContain(pdf.buffer);
  });
});
