import { NotFoundException } from '@nestjs/common';

import { SavingsService } from './savings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SavingsService', () => {
  let service: SavingsService;

  const prisma = {
    customer: {
      findUnique: jest.fn(),
    },
    savings: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SavingsService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create savings for an existing customer', async () => {
    const dto = {
      customerId: 'customer-1',
      amount: 5000,
      accountType: 'SAVINGS',
    };

    const customer = {
      id: 'customer-1',
      firstName: 'Test',
      lastName: 'Customer',
    };

    const created = {
      id: 'savings-1',
      ...dto,
      customer,
    };

    prisma.customer.findUnique = jest
      .fn()
      .mockResolvedValue(customer);

    prisma.savings.create = jest
      .fn()
      .mockResolvedValue(created);

    await expect(service.create(dto)).resolves.toBe(created);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'customer-1',
      },
    });

    expect(prisma.savings.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer-1',
        amount: 5000,
        accountType: 'SAVINGS',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should reject savings creation when customer does not exist', async () => {
    const dto = {
      customerId: 'missing-customer',
      amount: 5000,
      accountType: 'SAVINGS',
    };

    prisma.customer.findUnique = jest
      .fn()
      .mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toThrow(
      new NotFoundException('Customer not found'),
    );

    expect(prisma.savings.create).not.toHaveBeenCalled();
  });

  it('should return all savings ordered by newest first', async () => {
    const result = [
      {
        id: 'savings-1',
        customerId: 'customer-1',
        amount: 5000,
      },
    ];

    prisma.savings.findMany = jest
      .fn()
      .mockResolvedValue(result);

    await expect(service.findAll()).resolves.toBe(result);

    expect(prisma.savings.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should return a savings record by id', async () => {
    const result = {
      id: 'savings-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    prisma.savings.findUnique = jest
      .fn()
      .mockResolvedValue(result);

    await expect(service.findOne('savings-1')).resolves.toBe(result);

    expect(prisma.savings.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'savings-1',
      },
      include: {
        customer: true,
      },
    });
  });

  it('should throw when savings record does not exist', async () => {
    prisma.savings.findUnique = jest
      .fn()
      .mockResolvedValue(null);

    await expect(
      service.findOne('missing-savings'),
    ).rejects.toThrow(
      new NotFoundException('Savings account not found'),
    );
  });

  it('should delete an existing savings record', async () => {
    const existing = {
      id: 'savings-1',
      customerId: 'customer-1',
      amount: 5000,
    };

    const deleted = {
      ...existing,
    };

    prisma.savings.findUnique = jest
      .fn()
      .mockResolvedValue(existing);

    prisma.savings.delete = jest
      .fn()
      .mockResolvedValue(deleted);

    await expect(service.remove('savings-1')).resolves.toBe(deleted);

    expect(prisma.savings.delete).toHaveBeenCalledWith({
      where: {
        id: 'savings-1',
      },
    });
  });
});
