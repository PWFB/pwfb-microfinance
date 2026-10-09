import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { PermissionsService } from '../permissions/permissions.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: {} },
        { provide: PermissionsService, useValue: { assert: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
