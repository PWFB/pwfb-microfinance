import { NotFoundException } from '@nestjs/common';

import { LoansService } from './loans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LoansService', () => {
  let service: LoansService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: {
        findUnique: jest.fn(),
      },
      loan: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new LoansService(
      prisma as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a loan for an existing customer', async () => {
    const dto = {
      customerId: 'customer-1',
      amount: 100000,
      interestRate: 10,
      status: 'PENDING',
    };

    const customer = {
      id: 'customer-1',
      firstName: 'John',
      lastName: 'Doe',
    };

    const result = {
      id: 'loan-1',
      ...dto,
      customer,
      repayments: [],
    };

    prisma.customer.findUnique.mockResolvedValue(customer);
    prisma.loan.create.mockResolvedValue(result);

    await expect(service.create(dto)).resolves.toBe(result);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'customer-1',
      },
    });

    expect(prisma.loan.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer-1',
        amount: 100000,
        interestRate: 10,
        status: 'PENDING',
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  });

  it('should reject loan creation when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    const dto = {
      customerId: 'missing-customer',
      amount: 100000,
    };

    await expect(service.create(dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.loan.create).not.toHaveBeenCalled();
  });

  it('should return all loans ordered by newest first', async () => {
    const result = [
      {
        id: 'loan-1',
        customerId: 'customer-1',
        amount: 100000,
      },
    ];

    prisma.loan.findMany.mockResolvedValue(result);

    await expect(service.findAll()).resolves.toBe(result);

    expect(prisma.loan.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  });

  it('should return a loan by id', async () => {
    const result = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
      repayments: [],
    };

    prisma.loan.findUnique.mockResolvedValue(result);

    await expect(
      service.findOne('loan-1'),
    ).resolves.toBe(result);

    expect(prisma.loan.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'loan-1',
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  });

  it('should throw when loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne('missing-loan'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update an existing loan', async () => {
    const existingLoan = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
      interestRate: 10,
      repayments: [],
    };

    const updatedLoan = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 125000,
      interestRate: 12,
      repayments: [],
    };

    const dto = {
      amount: 125000,
      interestRate: 12,
    };

    prisma.loan.findUnique.mockResolvedValue(existingLoan);
    prisma.loan.update.mockResolvedValue(updatedLoan);

    await expect(
      service.update('loan-1', dto),
    ).resolves.toBe(updatedLoan);

    expect(prisma.loan.update).toHaveBeenCalledWith({
      where: {
        id: 'loan-1',
      },
      data: {
        customerId: undefined,
        amount: 125000,
        interestRate: 12,
        status: undefined,
      },
      include: {
        customer: true,
        repayments: true,
      },
    });
  });

  it('should reject update when the new customer does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      customerId: 'customer-1',
    });

    prisma.customer.findUnique.mockResolvedValue(null);

    const dto = {
      customerId: 'missing-customer',
    };

    await expect(
      service.update('loan-1', dto),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.loan.update).not.toHaveBeenCalled();
  });

  it('should delete an existing loan', async () => {
    const existingLoan = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
    };

    prisma.loan.findUnique.mockResolvedValue(existingLoan);
    prisma.loan.delete.mockResolvedValue(existingLoan);

    await expect(
      service.remove('loan-1'),
    ).resolves.toBe(existingLoan);

    expect(prisma.loan.delete).toHaveBeenCalledWith({
      where: {
        id: 'loan-1',
      },
    });
  });
});
