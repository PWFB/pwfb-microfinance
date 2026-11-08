import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerVirtualAccountService } from '../banking/customer-virtual-account.service';
import { AccessScopeService } from '../access/access-scope.service';
import { ChargesService } from '../charges/charges.service';

describe('CustomersService', () => {
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: {},
        },
        { provide: CustomerVirtualAccountService, useValue: {} },
        { provide: AccessScopeService, useValue: {} },
        { provide: ChargesService, useValue: {} },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
