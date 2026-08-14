import { Test, TestingModule } from '@nestjs/testing';
import { PeriodsController } from './periods.controller';

describe('PeriodsController', () => {
  let controller: PeriodsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PeriodsController],
    }).compile();

    controller = module.get<PeriodsController>(PeriodsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
