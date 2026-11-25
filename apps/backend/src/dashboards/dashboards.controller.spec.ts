import { Test, TestingModule } from '@nestjs/testing';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('DashboardsController', () => {
  let controller: DashboardsController;
  let accessScope: { assertBranch: jest.Mock };
  let dashboards: { branchSummary: jest.Mock; coSummary: jest.Mock };

  beforeEach(async () => {
    accessScope = { assertBranch: jest.fn().mockResolvedValue(true) };
    dashboards = {
      branchSummary: jest.fn().mockResolvedValue({ branchId: 'branch-a' }),
      coSummary: jest.fn().mockResolvedValue({ total: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardsController],
      providers: [
        { provide: DashboardsService, useValue: dashboards },
        { provide: AccessScopeService, useValue: accessScope },
      ],
    }).compile();

    controller = module.get<DashboardsController>(DashboardsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('checks the signed-in user scope before loading a branch dashboard', async () => {
    const user = { id: 'staff-user', role: 'BRANCH_MANAGER' };
    await expect(controller.branchSummary('branch-a', 'period-nov', { user }))
      .resolves.toEqual({ branchId: 'branch-a' });

    expect(accessScope.assertBranch).toHaveBeenCalledWith(user, 'branch-a');
    expect(dashboards.branchSummary).toHaveBeenCalledWith('branch-a', 'period-nov');
  });

  it('does not load a branch dashboard when the scope check rejects', async () => {
    accessScope.assertBranch.mockRejectedValueOnce(new Error('outside assigned branch'));
    await expect(controller.branchSummary('branch-b', undefined, {
      user: { id: 'staff-user', role: 'BRANCH_MANAGER' },
    })).rejects.toThrow('outside assigned branch');

    expect(dashboards.branchSummary).not.toHaveBeenCalled();
  });
});
