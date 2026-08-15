import { Test, TestingModule } from '@nestjs/testing';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';

describe('CashbookController', () => {
  let controller: CashbookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CashbookController],
      providers: [
        {
          provide: CashbookService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<CashbookController>(CashbookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
