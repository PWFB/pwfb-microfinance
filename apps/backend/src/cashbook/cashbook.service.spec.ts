import { Test, TestingModule } from '@nestjs/testing';
import { CashbookService } from './cashbook.service';

describe('CashbookService', () => {
  let service: CashbookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashbookService],
    }).compile();

    service = module.get<CashbookService>(CashbookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
