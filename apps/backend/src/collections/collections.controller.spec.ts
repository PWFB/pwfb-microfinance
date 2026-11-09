import { Test, TestingModule } from '@nestjs/testing';
import { CollectionsService } from './collections.service';
import { CollectionsController } from './collections.controller';
import { PermissionsService } from '../permissions/permissions.service';
import { AccessScopeService } from '../access/access-scope.service';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let collectionsService: any;
  let permissions: any;
  let accessScope: any;

  beforeEach(async () => {
    collectionsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      summary: jest.fn(),
      dailySummary: jest.fn(),
    };
    permissions = { assert: jest.fn().mockResolvedValue(true) };
    accessScope = {
      getScope: jest.fn().mockResolvedValue({
        role: 'BRANCH_MANAGER',
        staffId: 'staff-1',
        branchId: 'branch-1',
        areaId: null,
        divisionId: null,
        regionId: null,
        global: false,
      }),
      getScopedBranchIds: jest.fn().mockResolvedValue(['branch-1']),
      assertBranch: jest.fn().mockResolvedValue(true),
      assertStaff: jest.fn().mockResolvedValue(true),
      assertCustomer: jest.fn().mockResolvedValue(true),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        { provide: CollectionsService, useValue: collectionsService },
        { provide: PermissionsService, useValue: permissions },
        { provide: AccessScopeService, useValue: accessScope },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
  });


  it('limits Branch Manager collection totals to their assigned branch', async () => {
    collectionsService.summary.mockResolvedValue({ total: 100, collectionCount: 1 });

    await controller.summary(
      { user: { id: 'manager-user', role: 'BRANCH_MANAGER' } },
    );

    expect(collectionsService.summary).toHaveBeenCalledWith(
      undefined,
      'branch-1',
      undefined,
      undefined,
    );
  });

  it('aggregates Area Manager collection summaries across only area branches', async () => {
    accessScope.getScope.mockResolvedValue({
      role: 'AREA_MANAGER',
      staffId: 'area-manager-staff',
      branchId: null,
      areaId: 'area-1',
      divisionId: null,
      regionId: null,
      global: false,
    });
    accessScope.getScopedBranchIds.mockResolvedValue(['branch-1', 'branch-2']);
    collectionsService.summary.mockResolvedValue({ total: 300, collectionCount: 4 });

    await controller.summary(
      { user: { id: 'area-user', role: 'AREA_MANAGER' } },
    );

    expect(collectionsService.summary).toHaveBeenCalledWith(
      undefined,
      undefined,
      undefined,
      ['branch-1', 'branch-2'],
    );
  });

  it('limits Credit Officer collection summaries to their own Staff ID', async () => {
    accessScope.getScope.mockResolvedValue({
      role: 'CREDIT_OFFICER',
      staffId: 'officer-1',
      branchId: 'branch-1',
      areaId: null,
      divisionId: null,
      regionId: null,
      global: false,
    });
    collectionsService.summary.mockResolvedValue({ total: 50, collectionCount: 1 });

    await controller.summary(
      { user: { id: 'officer-user', role: 'CREDIT_OFFICER' } },
    );

    expect(collectionsService.summary).toHaveBeenCalledWith(
      undefined,
      'branch-1',
      'officer-1',
      undefined,
    );
  });

  it('does not let a Teller attribute a collection to another Staff ID', async () => {
    accessScope.getScope.mockResolvedValue({
      role: 'TELLER',
      staffId: 'teller-1',
      branchId: 'branch-1',
      areaId: null,
      divisionId: null,
      regionId: null,
      global: false,
    });

    await expect(controller.create(
      { user: { id: 'teller-user', role: 'TELLER' } },
      {
        periodId: 'period-1',
        branchId: 'branch-1',
        staffId: 'another-staff',
        customerId: 'customer-1',
        type: 'LOAN_REPAYMENT',
        amount: 100,
      } as any,
    )).rejects.toThrow('Collection Staff ID must match');
    expect(collectionsService.create).not.toHaveBeenCalled();
  });


  it('checks collection ownership before returning a single collection', async () => {
    collectionsService.findOne.mockResolvedValue({ id: 'collection-1' });

    await controller.findOne('collection-1', {
      user: { id: 'branch-user', role: 'BRANCH_MANAGER' },
    });

    expect(accessScope.assertCollection).toHaveBeenCalledWith(
      { id: 'branch-user', role: 'BRANCH_MANAGER' },
      'collection-1',
    );
    expect(collectionsService.findOne).toHaveBeenCalledWith('collection-1');
  });

  it('checks collection ownership and settle permission before financial settlement', async () => {
    collectionsService.settle.mockResolvedValue({ id: 'collection-1', settled: true });
    const user = { id: 'teller-user', role: 'TELLER' };

    await controller.settle(
      { user },
      'collection-1',
      { targetId: 'loan-1' },
    );

    expect(permissions.assert).toHaveBeenCalledWith('TELLER', 'COLLECTION_SETTLE');
    expect(accessScope.assertCollection).toHaveBeenCalledWith(user, 'collection-1');
    expect(collectionsService.settle).toHaveBeenCalledWith('collection-1', 'loan-1');
  });

  it('does not reconcile a collection outside the caller organizational scope', async () => {
    accessScope.assertCollection.mockRejectedValueOnce(new Error('outside your organizational scope'));

    await expect(controller.reconcile(
      'collection-1',
      { user: { id: 'admin-user', role: 'ADMIN' } },
    )).rejects.toThrow('outside your organizational scope');

    expect(collectionsService.reconcile).not.toHaveBeenCalled();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
