import { NotFoundException } from '@nestjs/common';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  const prisma = {
    customer: {
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransactionsService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a transaction for an existing customer', async () => {
    const dto = {
      customerId: 'customer-1',
      type: 'DEPOSIT',
      amount: 5000,
      description: 'Cash deposit',
    };

    const result = {
      id: 'transaction-1',
      ...dto,
    };

    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-1',
    });

    prisma.transaction.create.mockResolvedValue(result);

    await expect(
      service.create(dto),
    ).resolves.toBe(result);

    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer-1',
        type: 'DEPOSIT',
        amount: 5000,
        description: 'Cash deposit',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should reject transaction creation when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        customerId: 'missing-customer',
        type: 'DEPOSIT',
        amount: 1000,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('should return all transactions ordered by newest first', async () => {
    const result = [
      {
        id: 'transaction-1',
        customerId: 'customer-1',
        type: 'DEPOSIT',
        amount: 5000,
      },
    ];

    prisma.transaction.findMany.mockResolvedValue(result);

    await expect(
      service.findAll(),
    ).resolves.toBe(result);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should return a transaction by id', async () => {
    const result = {
      id: 'transaction-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    prisma.transaction.findUnique.mockResolvedValue(result);

    await expect(
      service.findOne('transaction-1'),
    ).resolves.toBe(result);
  });

  it('should throw when transaction does not exist', async () => {
    prisma.transaction.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne('missing-transaction'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update an existing transaction', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'transaction-1',
      } as any);

    const dto = {
      amount: 7500,
      description: 'Updated deposit',
    };

    const result = {
      id: 'transaction-1',
      amount: 7500,
      description: 'Updated deposit',
    };

    prisma.transaction.update.mockResolvedValue(result);

    await expect(
      service.update('transaction-1', dto),
    ).resolves.toBe(result);

    expect(prisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 'transaction-1' },
      data: {
        customerId: undefined,
        type: undefined,
        amount: 7500,
        description: 'Updated deposit',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should reject update when the new customer does not exist', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'transaction-1',
      } as any);

    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(
      service.update('transaction-1', {
        customerId: 'missing-customer',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });

  it('should delete an existing transaction', async () => {
    jest
      .spyOn(service, 'findOne')
      .mockResolvedValue({
        id: 'transaction-1',
      } as any);

    const result = {
      id: 'transaction-1',
    };

    prisma.transaction.delete.mockResolvedValue(result);

    await expect(
      service.remove('transaction-1'),
    ).resolves.toBe(result);

    expect(prisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'transaction-1' },
    });
  });
});
