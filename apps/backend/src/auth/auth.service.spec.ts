import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    customer: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };
  let previousSuperAdminEmail: string | undefined;

  beforeEach(async () => {
    previousSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    process.env.SUPER_ADMIN_EMAIL = 'configured-super-admin@example.com';

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      customer: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('test-access-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    if (previousSuperAdminEmail === undefined) delete process.env.SUPER_ADMIN_EMAIL;
    else process.env.SUPER_ADMIN_EMAIL = previousSuperAdminEmail;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('creates a linked customer profile and zero-balance wallet atomically during registration', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const customerCreate = jest.fn().mockResolvedValue({
      id: 'customer-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '08012345678',
    });
    const userCreate = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'ada@example.com',
      password: 'hashed-password',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '08012345678',
      role: 'CUSTOMER',
      customerId: 'customer-1',
    });
    prisma.$transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        customer: { create: customerCreate },
        user: { create: userCreate },
      }),
    );

    const result = await service.register({
      email: ' Ada@Example.com ',
      password: 'secure-password',
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      phone: ' 08012345678 ',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(customerCreate).toHaveBeenCalledWith({
      data: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '08012345678',
        wallet: { create: {} },
      },
    });
    expect(userCreate).toHaveBeenCalledWith({
      data: {
        email: 'ada@example.com',
        password: expect.any(String),
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '08012345678',
        passportPhoto: undefined,
        role: 'CUSTOMER',
        customer: { connect: { id: 'customer-1' } },
      },
    });
    expect(result).toMatchObject({
      message: 'Registration successful',
      access_token: 'test-access-token',
      onboarding: {
        profileCreated: true,
        walletCreated: true,
        virtualAccountStatus: 'NOT_REQUESTED',
      },
    });
    expect((result as any).user.password).toBeUndefined();
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'ada@example.com',
      role: 'CUSTOMER',
    });
  });

  it('does not let public registration create the configured Super Admin identity', async () => {
    await expect(
      service.register({
        email: 'CONFIGURED-SUPER-ADMIN@example.com',
        password: 'secure-password',
        firstName: 'Admin',
        lastName: 'Account',
        phone: '08012345678',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate login emails before creating records', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user', email: 'ada@example.com' });

    await expect(
      service.register({
        email: 'ada@example.com',
        password: 'secure-password',
        firstName: 'Ada',
        lastName: 'Lovelace',
        phone: '08012345678',
      }),
    ).rejects.toThrow('User already exists');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires the customer identity fields needed by the registration flow', async () => {
    await expect(
      service.register({
        email: 'ada@example.com',
        password: 'secure-password',
        firstName: '',
        lastName: 'Lovelace',
        phone: '08012345678',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
