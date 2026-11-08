import { Test, TestingModule } from '@nestjs/testing';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { TwoFactorService } from '../auth/two-factor.service';

describe('PeriodsController', () => {
  let controller: PeriodsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeriodsController],
      providers: [
        {
          provide: PeriodsService,
          useValue: {},
        },
        { provide: TwoFactorService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PeriodsController>(PeriodsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
