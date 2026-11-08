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
      $executeRawUnsafe: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
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
      { getScope: jest.fn().mockResolvedValue({ role: 'SUPER_ADMIN', global: true, staffId: null }), getBranchIds: jest.fn().mockResolvedValue(null), assertCustomer: jest.fn().mockResolvedValue(true), assertLoan: jest.fn().mockResolvedValue(true) } as any,
    );
    jest.spyOn(service as any, 'withMeta').mockImplementation(async (loan: any) => loan);
    prisma.$queryRawUnsafe.mockResolvedValue([{ interestRate: 0 }]);
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
      status: 'PENDING',
    };

    prisma.customer.findUnique.mockResolvedValue(customer);
    prisma.loan.create.mockResolvedValue(result);

    await expect(service.create(dto, { role: 'SUPER_ADMIN' })).resolves.toEqual(result);

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'customer-1',
      },
    });

    expect(prisma.loan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerId: 'customer-1',
        amount: 100000,
        interestRate: 10,
        status: 'PENDING',
      }),
      include: expect.objectContaining({
        customer: true,
        repayments: true,
        guarantors: true,
      }),
    }));
  });

  it('should reject loan creation when customer does not exist', async () => {
    prisma.customer.findUnique.mockResolvedValue(null);

    const dto = {
      customerId: 'missing-customer',
      amount: 100000,
    };

    await expect(service.create(dto, { role: 'SUPER_ADMIN' })).rejects.toBeInstanceOf(
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

    await expect(service.findAll({ role: 'SUPER_ADMIN' })).resolves.toEqual(result);

    expect(prisma.loan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      orderBy: { createdAt: 'desc' },
      include: expect.objectContaining({
        customer: expect.objectContaining({
          include: expect.objectContaining({
            bankAccounts: expect.any(Object),
          }),
        }),
        repayments: true,
        guarantors: true,
      }),
    }));
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
      service.findOne('loan-1', { role: 'SUPER_ADMIN' }),
    ).resolves.toEqual(result);

    expect(prisma.loan.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'loan-1',
      },
      include: expect.objectContaining({
        customer: expect.objectContaining({
          include: expect.objectContaining({
            bankAccounts: expect.any(Object),
          }),
        }),
        repayments: true,
        guarantors: true,
      }),
    });
  });

  it('should throw when loan does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue(null);

    await expect(
      service.findOne('missing-loan', { role: 'SUPER_ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should update an existing loan', async () => {
    const existingLoan = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
      interestRate: 10,
      status: 'PENDING',
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
      service.update('loan-1', dto, { role: 'SUPER_ADMIN' }),
    ).resolves.toEqual(updatedLoan);

    expect(prisma.loan.update).toHaveBeenCalledWith(expect.objectContaining({
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
        guarantors: true,
      },
    }));
  });

  it('should reject update when the new customer does not exist', async () => {
    prisma.loan.findUnique.mockResolvedValue({
      id: 'loan-1',
      customerId: 'customer-1',
      status: 'PENDING',
    });

    prisma.customer.findUnique.mockResolvedValue(null);

    const dto = {
      customerId: 'missing-customer',
    };

    await expect(
      service.update('loan-1', dto, { role: 'SUPER_ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.loan.update).not.toHaveBeenCalled();
  });

  it('should delete an existing loan', async () => {
    const existingLoan = {
      id: 'loan-1',
      customerId: 'customer-1',
      amount: 100000,
      status: 'PENDING',
      repayments: [],
    };

    prisma.loan.findUnique.mockResolvedValue(existingLoan);
    prisma.loan.delete.mockResolvedValue(existingLoan);

    await expect(
      service.remove('loan-1', { role: 'SUPER_ADMIN' }),
    ).resolves.toEqual(existingLoan);

    expect(prisma.loan.delete).toHaveBeenCalledWith({
      where: {
        id: 'loan-1',
      },
    });
  });
});
