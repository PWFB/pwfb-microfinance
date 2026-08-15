import { Test, TestingModule } from '@nestjs/testing';
import { PeriodsService } from './periods.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PeriodsService', () => {
  let service: PeriodsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodsService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PeriodsService>(PeriodsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
