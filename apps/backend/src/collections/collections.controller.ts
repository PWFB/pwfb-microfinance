import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  private async filters(user: any, requestedBranchId?: string, requestedStaffId?: string) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return { branchId: requestedBranchId, branchIds: null as string[] | null, staffId: requestedStaffId };
    const branchIds = await this.accessScope.getBranchIds(user);
    if (!branchIds?.length) throw new ForbiddenException('Your account has no assigned branch or organizational scope');
    if (requestedBranchId && !branchIds.includes(requestedBranchId)) throw new ForbiddenException('You cannot view collections from another branch');
    if (scope.role === 'CREDIT_OFFICER') {
      if (!scope.staffId) throw new ForbiddenException('Credit officer account is not linked to a Staff ID');
      if (requestedStaffId && requestedStaffId !== scope.staffId) throw new ForbiddenException('Credit officers can view only their own daily collections');
      return { branchId: scope.branchId || undefined, branchIds, staffId: scope.staffId };
    }
    if (requestedStaffId) await this.accessScope.assertStaff(user, requestedStaffId);
    return { branchId: requestedBranchId || (branchIds.length === 1 ? branchIds[0] : undefined), branchIds, staffId: requestedStaffId };
  }

  @Post()
  @Roles(...SETTLE_ROLES)
  async create(@Req() req: any, @Body() body: { periodId: string; branchId: string; staffId: string; customerId: string; type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER'; amount: number; reference?: string; notes?: string; collectionDate?: string; settleNow?: boolean }) {
    await this.permissions.assert(req.user.role, 'COLLECTION_CREATE');
    const scope = await this.accessScope.getScope(req.user);
    let input = { ...body };
    if (scope.role === 'CREDIT_OFFICER') {
      if (!scope.staffId || !scope.branchId) throw new ForbiddenException('Credit officer account is not assigned to a branch and Staff ID');
      if (body.branchId !== scope.branchId || (body.staffId && body.staffId !== scope.staffId)) throw new ForbiddenException('Credit officers can record collections only for themselves in their assigned branch');
      input = { ...body, branchId: scope.branchId, staffId: scope.staffId };
    } else {
      await this.accessScope.assertBranch(req.user, body.branchId);
      await this.accessScope.assertStaff(req.user, body.staffId);
    }
    await this.accessScope.assertCustomer(req.user, body.customerId);
    return this.collectionsService.create(input);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string, @Query('type') type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER') {
    const filters = await this.filters(req.user, branchId, staffId);
    return this.collectionsService.findAll(periodId, filters.branchId, filters.staffId, type, filters.branchIds);
  }

  @Get('summary')
  @Roles(...VIEW_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string) {
    const filters = await this.filters(req.user, branchId, staffId);
    return this.collectionsService.summary(periodId, filters.branchId, filters.staffId, filters.branchIds);
  }

  @Get('daily/:date')
  @Roles(...VIEW_ROLES)
  async dailySummary(@Req() req: any, @Param('date') date: string, @Query('branchId') branchId?: string) {
    const filters = await this.filters(req.user, branchId);
    return this.collectionsService.dailySummary(date, filters.branchId, filters.staffId, filters.branchIds);
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertCollection(req.user, id);
    return this.collectionsService.findOne(id);
  }

  @Post(':id/settle')
  @Roles(...SETTLE_ROLES)
  async settle(@Req() req: any, @Param('id') id: string, @Body() body: { targetId?: string }) {
    await this.permissions.assert(req.user.role, 'COLLECTION_SETTLE');
    await this.accessScope.assertCollection(req.user, id);
    return this.collectionsService.settle(id, body.targetId);
  }

  @Patch(':id/reconcile')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER')
  async reconcile(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertCollection(req.user, id);
    return this.collectionsService.reconcile(id);
  }

  @Patch(':id/unreconcile')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER')
  async unreconcile(@Param('id') id: string, @Req() req: any) {
    await this.accessScope.assertCollection(req.user, id);
    return this.collectionsService.unreconcile(id);
  }
}
