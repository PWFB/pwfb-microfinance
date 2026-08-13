import { NotFoundException } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';

describe('RepaymentsService', () => {
  let service: RepaymentsService;

  const prisma = {
    loan: {
      findUnique: jest.fn(),
    },
    repayment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RepaymentsService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a repayment for an existing loan', async () => {
    const dto = {
      loanId: 'loan-1',
      amount: 2500,
      paymentDate: '2026-08-12T00:00:00.000Z',
      method: 'CASH',
      notes: 'First repayment',
    };

    const loan = { id: 'loan-1' };
    const result = {
      id: 'repayment-1',
      ...dto,
    };

    prisma.loan.findUnique.mockResolvedValue(loan);
    prisma.repayment.create.mockResolvedValue(result);

    await expect(service.create(dto)).resolves.toBe(result);

    expect(prisma.loan.findUnique).toHaveBeenCalledWith({
      where: { id: 'loan-1' },
    });

    expect(prisma.repayment.create).toHaveBeenCalledWith({
      data: {
        loanId: 'loan-1',
        amount: 2500,
        paymentDate: new Date(dto.paymentDate),
        method: 'CASH',
        notes: 'First repayment',
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  });

  it('should reject repayment creation when loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        loanId: 'missing-loan',
        amount: 1000,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.repayment.create).not.toHaveBeenCalled();
  });

  it('should return all repayments ordered by newest first', async () => {
    const result = [
      {
        id: 'repayment-1',
        loanId: 'loan-1',
        amount: 2500,
      },
    ];

    prisma.repayment.findMany.mockResolvedValue(result);

    await expect(service.findAll()).resolves.toBe(result);

    expect(prisma.repayment.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  });

  it('should return a repayment by id', async () => {
    const result = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 2500,
    };

    prisma.repayment.findUnique.mockResolvedValue(result);

    await expect(
      service.findOne('repayment-1'),
    ).resolves.toBe(result);

    expect(prisma.repayment.findUnique).toHaveBeenCalledWith({
      where: { id: 'repayment-1' },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  });

  it('should throw when repayment does not exist', async () => {
    prisma.repayment.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne('missing-repayment'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update an existing repayment', async () => {
    const existing = {
      id: 'repayment-1',
      loanId: 'loan-1',
    };

    const dto = {
      amount: 3000,
      method: 'BANK_TRANSFER',
    };

    const result = {
      id: 'repayment-1',
      loanId: 'loan-1',
      amount: 3000,
      method: 'BANK_TRANSFER',
    };

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(existing as any);

    prisma.repayment.update.mockResolvedValue(result);

    await expect(
      service.update('repayment-1', dto),
    ).resolves.toBe(result);

    expect(prisma.repayment.update).toHaveBeenCalledWith({
      where: { id: 'repayment-1' },
      data: {
        loanId: undefined,
        amount: 3000,
        paymentDate: undefined,
        method: 'BANK_TRANSFER',
        notes: undefined,
      },
      include: {
        loan: {
          include: {
            customer: true,
          },
        },
      },
    });
  });

  it('should reject update when the new loan does not exist', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'repayment-1',
      } as any);

    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(
      service.update('repayment-1', {
        loanId: 'missing-loan',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.repayment.update).not.toHaveBeenCalled();
  });

  it('should delete an existing repayment', async () => {
    const existing = {
      id: 'repayment-1',
    };

    const result = {
      id: 'repayment-1',
    };

    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue(existing as any);

    prisma.repayment.delete.mockResolvedValue(result);

    await expect(
      service.remove('repayment-1'),
    ).resolves.toBe(result);

    expect(prisma.repayment.delete).toHaveBeenCalledWith({
      where: { id: 'repayment-1' },
    });
  });
});
