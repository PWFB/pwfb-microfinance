import { Test, TestingModule } from '@nestjs/testing';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { AccessScopeService } from '../access/access-scope.service';

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
        { provide: AccessScopeService, useValue: { getScope: jest.fn(), assertBranch: jest.fn(), filterList: jest.fn() }
        },
      ],
    }).compile();

    controller = module.get<CashbookController>(CashbookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
