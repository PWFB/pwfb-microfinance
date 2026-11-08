import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { PermissionsService } from '../permissions/permissions.service';
import { AccessScopeService } from '../access/access-scope.service';
import { TwoFactorService } from '../auth/two-factor.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: {} },
        { provide: PermissionsService, useValue: { assert: jest.fn() } },
        { provide: AccessScopeService, useValue: { getScope: jest.fn(), getBranchIds: jest.fn(), assertBranch: jest.fn(), assertStaff: jest.fn(), assertLoan: jest.fn() } },
        { provide: TwoFactorService, useValue: { assertVerified: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
