import { Test, TestingModule } from '@nestjs/testing';
import { CashbookService } from './cashbook.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CashbookService', () => {
  let service: CashbookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CashbookService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CashbookService>(CashbookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
