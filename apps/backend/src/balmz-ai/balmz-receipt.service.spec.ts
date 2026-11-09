import { BalmzReceiptService } from './balmz-receipt.service';

describe('BalmzReceiptService wallet receipt reconciliation', () => {
  const prisma: any = {
    transaction: { findMany: jest.fn() },
    walletTransaction: { findMany: jest.fn() },
    dailyCollection: { findMany: jest.fn() },
    receiptVerification: { create: jest.fn() },
  };
  const accessScope: any = {
    getScope: jest.fn(),
    getScopedBranchIds: jest.fn(),
  };
  let service: BalmzReceiptService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BalmzReceiptService(prisma, accessScope);
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.walletTransaction.findMany.mockResolvedValue([]);
    prisma.dailyCollection.findMany.mockResolvedValue([]);
  });

  it('matches a customer-uploaded receipt against only that customer wallet transaction', async () => {
    prisma.walletTransaction.findMany.mockResolvedValueOnce([
      { id: 'wallet-tx-1', amount: 1500, type: 'DEPOSIT', status: 'COMPLETED' },
    ]);

    const match = await (service as any).findDatabaseMatch('BANK-REF-1500', 1500, {
      id: 'customer-user-1',
      role: 'CUSTOMER',
      customerId: 'customer-1',
    });

    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith({
      where: {
        customerId: 'customer-1',
        OR: [
          { reference: { contains: 'BANK-REF-1500', mode: 'insensitive' } },
          { providerReference: { contains: 'BANK-REF-1500', mode: 'insensitive' } },
        ],
      },
      select: { id: true, amount: true, type: true, status: true },
      take: 5,
    });
    expect(match).toMatchObject({
      matched: true,
      source: 'wallet',
      id: 'wallet-tx-1',
      amount: 1500,
      status: 'COMPLETED',
    });
  });

  it('limits a Credit Officer receipt lookup to the assigned branch and Staff ID', async () => {
    accessScope.getScope.mockResolvedValue({ role: 'CREDIT_OFFICER', staffId: 'staff-1', global: false });
    accessScope.getScopedBranchIds.mockResolvedValue(['branch-1']);

    await (service as any).findDatabaseMatch('BANK-REF-500', 500, {
      id: 'officer-user-1',
      role: 'CREDIT_OFFICER',
      staffId: 'staff-1',
    });

    expect(prisma.walletTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        AND: [
          {
            OR: [
              { branchId: { in: ['branch-1'] } },
              { branchId: null },
            ],
            customer: {
              branchId: { in: ['branch-1'] },
              assignedStaffId: 'staff-1',
            },
          },
          {
            OR: [
              { reference: { contains: 'BANK-REF-500', mode: 'insensitive' } },
              { providerReference: { contains: 'BANK-REF-500', mode: 'insensitive' } },
            ],
          },
        ],
      },
    }));
  });

  it('creates and returns a permanent receipt reference when storing an upload result', async () => {
    prisma.receiptVerification.create.mockResolvedValue({ id: 'receipt-id-1' });
    const result = await (service as any).persistReceipt(
      { buffer: Buffer.from('test-image'), mimetype: 'image/png', originalname: 'payment.png' },
      { id: 'user-1' },
      {
        assistant: 'BALMZ AI',
        status: 'REVIEW',
        confidence: 50,
        message: 'Manual review required.',
        extracted: {
          paymentStatus: 'unknown',
          amount: null,
          currency: null,
          reference: null,
          date: null,
          sender: null,
          receiver: null,
          bankOrProvider: null,
        },
        databaseMatch: { matched: false, source: null, id: null, amount: null, status: null },
        reasons: ['Not enough information.'],
      },
    );

    expect(result.receiptReference).toMatch(/^PWFB-RCP-/);
    expect(result.receiptId).toBe('receipt-id-1');
    expect(prisma.receiptVerification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        reference: result.receiptReference,
        uploadedByUserId: 'user-1',
      }),
    }));
  });
});
