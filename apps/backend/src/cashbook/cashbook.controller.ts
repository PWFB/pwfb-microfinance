import { Body, Controller, Delete, ForbiddenException, BadRequestException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import type { CashbookDailyInput } from './cashbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { PermissionsService } from '../permissions/permissions.service';

const CASHBOOK_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'TELLER', 'CREDIT_OFFICER'] as const;
const DAILY_WORK_ROLES = [...CASHBOOK_ROLES, 'CREDIT_OFFICER', 'LOAN_OFFICER', 'STAFF'] as const;

@Controller('cashbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashbookController {
  constructor(
    private readonly cashbookService: CashbookService,
    private readonly accessScope: AccessScopeService,
    private readonly twoFactorService: TwoFactorService,
    private readonly permissions: PermissionsService,
  ) {}

  private async requireFinancialMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  private async filters(user: any, requestedBranchId?: string, requestedStaffId?: string) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return { branchId: requestedBranchId, branchIds: null as string[] | null, staffId: requestedStaffId };
    const branchIds = await this.accessScope.getBranchIds(user);
    if (!branchIds?.length) throw new ForbiddenException('Your account has no assigned branch or organizational scope');
    if (requestedBranchId && !branchIds.includes(requestedBranchId)) throw new ForbiddenException('You cannot access another branch cashbook');
    if (scope.role === 'CREDIT_OFFICER' || scope.role === 'TELLER') {
      if (!scope.staffId) throw new ForbiddenException('Staff login is not linked to a Staff ID');
      if (requestedStaffId && requestedStaffId !== scope.staffId) throw new ForbiddenException('You can view only your own daily cashbook work');
      return { branchId: scope.branchId || undefined, branchIds, staffId: scope.staffId };
    }
    if (requestedStaffId) await this.accessScope.assertStaff(user, requestedStaffId);
    return { branchId: requestedBranchId || (branchIds.length === 1 ? branchIds[0] : undefined), branchIds, staffId: requestedStaffId };
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TELLER')
  async create(@Body() body: {
    periodId: string;
    branchId: string;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reference?: string;
    description?: string;
    entryDate?: string;
    staffId?: string;
  }, @Req() req: any) {
    await this.permissions.assert(req.user.role, 'CASHBOOK_CREATE');
    if (String(req.user?.role || '').toUpperCase() === 'TELLER' && body.type !== 'CASH_IN') {
      throw new ForbiddenException('Tellers may post cash receipts only. Cash payments require an authorized branch finance role.');
    }
    await this.accessScope.assertBranch(req.user, body.branchId);
    const scope = await this.accessScope.getScope(req.user);
    const staffId = scope.role === 'TELLER'
      ? String(scope.staffId || '')
      : String(body.staffId || '');
    if (scope.role === 'TELLER' && !staffId) throw new ForbiddenException('Teller login is not linked to an active Staff ID');
    if (staffId) {
      await this.accessScope.assertStaff(req.user, staffId);
      const staffScope = await this.accessScope.getScope({ id: staffId, staffId, role: 'STAFF' });
      if (staffScope.branchId !== body.branchId) throw new ForbiddenException('Cashbook collector must belong to the selected branch');
    }
    await this.requireFinancialMfa(req);
    return this.cashbookService.create({ ...body, staffId: staffId || undefined });
  }

  @Get('daily/opening-balance')
  @Roles(...DAILY_WORK_ROLES)
  async openingBalance(@Req() req: any, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string, @Query('entryDate') entryDate?: string) {
    const filters = await this.filters(req.user, branchId, staffId);
    const selectedBranchId = filters.branchId || (filters.branchIds?.length === 1 ? filters.branchIds[0] : undefined);
    if (!selectedBranchId) throw new BadRequestException('Select a branch to calculate its previous cash-at-hand balance');
    return this.cashbookService.getOpeningBalance(selectedBranchId, filters.staffId, entryDate);
  }

  @Get('daily/summary')
  @Roles(...DAILY_WORK_ROLES)
  async dailySummary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('staffId') staffId?: string) {
    const filters = await this.filters(req.user, branchId, staffId);
    return this.cashbookService.dailySummary(periodId, filters.branchId, from, to, filters.staffId, filters.branchIds);
  }

  @Get('daily')
  @Roles(...DAILY_WORK_ROLES)
  async findDaily(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string, @Query('staffId') staffId?: string) {
    const filters = await this.filters(req.user, branchId, staffId);
    return this.cashbookService.findDaily(periodId, filters.branchId, from, to, filters.staffId, filters.branchIds);
  }

  @Post('daily')
  @Roles(...DAILY_WORK_ROLES)
  async createDaily(@Body() body: CashbookDailyInput, @Req() req: any) {
    await this.permissions.assert(req.user.role, 'CASHBOOK_DAILY_CREATE');
    const scope = await this.accessScope.getScope(req.user);
    const allowedBranches = await this.accessScope.getBranchIds(req.user);
    if (!scope.global && (!allowedBranches?.includes(body.branchId))) throw new ForbiddenException('You cannot create a daily cashbook record for another branch');
    if (scope.role === 'CREDIT_OFFICER' || scope.role === 'TELLER') {
      if (!scope.staffId || !scope.branchId) throw new ForbiddenException('Staff login is not linked to a branch and Staff ID');
      if (body.staffId && body.staffId !== scope.staffId) throw new ForbiddenException('You can record only your own daily work');
      if (body.branchId !== scope.branchId) throw new ForbiddenException('Staff branch assignment does not match this record');
      await this.requireFinancialMfa(req);
      return this.cashbookService.createDaily({ ...body, staffId: scope.staffId, branchId: scope.branchId });
    }
    await this.requireFinancialMfa(req);
    if (body.staffId) {
      await this.accessScope.assertStaff(req.user, body.staffId);
      const staff = await this.accessScope.getScope({ id: body.staffId, staffId: body.staffId, role: 'STAFF' });
      if (staff.branchId !== body.branchId) throw new ForbiddenException('Selected staff member is not assigned to this branch');
    }
    return this.cashbookService.createDaily(body);
  }

  @Patch('daily/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  async updateDaily(@Param('id') id: string, @Body() body: Partial<CashbookDailyInput>, @Req() req: any) {
    const record = await this.cashbookService.dailyOne(id);
    await this.accessScope.assertBranch(req.user, record.branchId);
    if (record.staffId) await this.accessScope.assertStaff(req.user, record.staffId);
    return this.cashbookService.updateDaily(id, body);
  }

  @Delete('daily/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  async removeDaily(@Param('id') id: string, @Req() req: any) {
    const record = await this.cashbookService.dailyOne(id);
    await this.accessScope.assertBranch(req.user, record.branchId);
    if (record.staffId) await this.accessScope.assertStaff(req.user, record.staffId);
    return this.cashbookService.removeDaily(id);
  }

  @Get()
  @Roles(...CASHBOOK_ROLES)
  async findAll(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const filters = await this.filters(req.user, branchId);
    return this.cashbookService.findAll(periodId, filters.branchId, filters.branchIds, filters.staffId);
  }

  @Get('summary')
  @Roles(...CASHBOOK_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const filters = await this.filters(req.user, branchId);
    if (filters.branchIds && !filters.branchIds.length) throw new ForbiddenException('No branch cashbook is assigned to this account');
    return this.cashbookService.summary(periodId, filters.branchId, filters.branchIds, filters.staffId);
  }

  @Get(':id')
  @Roles(...CASHBOOK_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const entry = await this.cashbookService.findOne(id);
    await this.accessScope.assertBranch(req.user, entry.branchId);
    const scope = await this.accessScope.getScope(req.user);
    if ((scope.role === 'TELLER' || scope.role === 'CREDIT_OFFICER') && entry.staffId !== scope.staffId) {
      throw new ForbiddenException('You can access only cashbook entries attributed to your own Staff ID');
    }
    return entry;
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  async remove(@Param('id') id: string, @Req() req: any) {
    const entry = await this.cashbookService.findOne(id);
    await this.accessScope.assertBranch(req.user, entry.branchId);
    return this.cashbookService.remove(id);
  }
}
