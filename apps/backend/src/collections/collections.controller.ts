import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from '../permissions/permissions.service';
import { AccessScopeService } from '../access/access-scope.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];
const SETTLE_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];

@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(
    private readonly collectionsService: CollectionsService,
    private readonly permissions: PermissionsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async scopedFilters(user: any, requestedBranchId?: string, requestedStaffId?: string) {
    const scope = await this.accessScope.getScope(user);
    let branchId: string | undefined;
    let branchIds: string[] | undefined;
    let staffId: string | undefined;

    if (requestedBranchId) {
      await this.accessScope.assertBranch(user, requestedBranchId);
      branchId = requestedBranchId;
    } else if (scope.global) {
      branchId = undefined;
    } else if (scope.branchId) {
      branchId = scope.branchId;
    } else {
      branchIds = (await this.accessScope.getScopedBranchIds(user)) ?? [];
    }

    if (scope.role === 'CREDIT_OFFICER') {
      staffId = scope.staffId || undefined;
      if (!staffId) throw new Error('Credit Officer login is not linked to an active Staff record');
      if (requestedStaffId && requestedStaffId !== staffId) {
        await this.accessScope.assertStaff(user, requestedStaffId);
      }
    } else if (requestedStaffId) {
      await this.accessScope.assertStaff(user, requestedStaffId);
      staffId = requestedStaffId;
    }

    return { branchId, branchIds, staffId };
  }

  @Post()
  @Roles(...SETTLE_ROLES)
  async create(@Req() req: any, @Body() body: { periodId: string; branchId: string; staffId: string; customerId: string; type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER'; amount: number; reference?: string; notes?: string; collectionDate?: string; settleNow?: boolean }) {
    await this.permissions.assert(req.user.role, 'COLLECTION_CREATE');
    await this.accessScope.assertCustomer(req.user, body.customerId);
    const scope = await this.accessScope.getScope(req.user);
    const branchId = scope.global ? body.branchId : scope.branchId;
    const staffId = scope.global ? body.staffId : scope.staffId;
    if (!branchId || !staffId) throw new Error('Collection posting requires an assigned branch and Staff ID');
    if (scope.global) {
      await this.accessScope.assertBranch(req.user, branchId);
      await this.accessScope.assertStaff(req.user, staffId);
    } else {
      if (body.branchId && body.branchId !== branchId) await this.accessScope.assertBranch(req.user, body.branchId);
      if (body.staffId && body.staffId !== staffId) {
        throw new Error('Collection Staff ID must match the authenticated staff account');
      }
    }
    return this.collectionsService.create({ ...body, branchId, staffId });
  }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string, @Query('type') type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER') {
    const scope = await this.scopedFilters(req.user, branchId, staffId);
    return this.collectionsService.findAll(periodId, scope.branchId, scope.staffId, type, scope.branchIds);
  }

  @Get('summary')
  @Roles(...VIEW_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string) {
    const scope = await this.scopedFilters(req.user, branchId, staffId);
    return this.collectionsService.summary(periodId, scope.branchId, scope.staffId, scope.branchIds);
  }

  @Get('daily/:date')
  @Roles(...VIEW_ROLES)
  async dailySummary(@Req() req: any, @Param('date') date: string, @Query('branchId') branchId?: string) {
    const scope = await this.scopedFilters(req.user, branchId);
    return this.collectionsService.dailySummary(date, scope.branchId, scope.staffId, scope.branchIds);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  findOne(@Param('id') id:string) { return this.collectionsService.findOne(id); }

  @Post(':id/settle')
  @Roles(...SETTLE_ROLES)
  async settle(@Req() req:any,@Param('id') id:string,@Body() body:{targetId?:string}) {
    await this.permissions.assert(req.user.role,'COLLECTION_SETTLE');
    return this.collectionsService.settle(id, body.targetId);
  }

  @Patch(':id/reconcile')
  @Roles('SUPER_ADMIN','ADMIN')
  reconcile(@Param('id') id:string) { return this.collectionsService.reconcile(id); }

  @Patch(':id/unreconcile')
  @Roles('SUPER_ADMIN','ADMIN')
  unreconcile(@Param('id') id:string) { return this.collectionsService.unreconcile(id); }
}
