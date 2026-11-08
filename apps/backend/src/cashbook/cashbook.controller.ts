import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import type { CashbookDailyInput } from './cashbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

const CASHBOOK_ROLES = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'TELLER'] as const;
const DAILY_WORK_ROLES = [...CASHBOOK_ROLES, 'CREDIT_OFFICER', 'LOAN_OFFICER', 'STAFF'] as const;

@Controller('cashbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashbookController {
  constructor(
    private readonly cashbookService: CashbookService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async filters(user: any, requestedBranchId?: string, requestedStaffId?: string) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return { branchId: requestedBranchId, branchIds: null as string[] | null, staffId: requestedStaffId };
    const branchIds = await this.accessScope.getBranchIds(user);
    if (!branchIds?.length) throw new ForbiddenException('Your account has no assigned branch or organizational scope');
    if (requestedBranchId && !branchIds.includes(requestedBranchId)) throw new ForbiddenException('You cannot access another branch cashbook');
    if (scope.role === 'CREDIT_OFFICER') {
      if (!scope.staffId) throw new ForbiddenException('Credit officer account is not linked to a Staff ID');
      if (requestedStaffId && requestedStaffId !== scope.staffId) throw new ForbiddenException('Credit officers can view only their own daily work');
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
  }, @Req() req: any) {
    await this.accessScope.assertBranch(req.user, body.branchId);
    return this.cashbookService.create(body);
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
    const scope = await this.accessScope.getScope(req.user);
    const allowedBranches = await this.accessScope.getBranchIds(req.user);
    if (!scope.global && (!allowedBranches?.includes(body.branchId))) throw new ForbiddenException('You cannot create a daily cashbook record for another branch');
    if (scope.role === 'CREDIT_OFFICER') {
      if (!scope.staffId) throw new ForbiddenException('Credit officer account is not linked to a Staff ID');
      if (body.staffId && body.staffId !== scope.staffId) throw new ForbiddenException('Credit officers can record only their own daily work');
      if (body.branchId !== scope.branchId) throw new ForbiddenException('Credit officer branch assignment does not match this record');
      return this.cashbookService.createDaily({ ...body, staffId: scope.staffId, branchId: scope.branchId });
    }
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
    return this.cashbookService.findAll(periodId, filters.branchId, filters.branchIds);
  }

  @Get('summary')
  @Roles(...CASHBOOK_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const filters = await this.filters(req.user, branchId);
    if (filters.branchIds && !filters.branchIds.length) throw new ForbiddenException('No branch cashbook is assigned to this account');
    if (filters.branchIds && !filters.branchId) {
      const entries = await this.cashbookService.findAll(periodId, undefined, filters.branchIds);
      const cashIn = entries.filter((entry: any) => entry.type === 'CASH_IN').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
      const cashOut = entries.filter((entry: any) => entry.type === 'CASH_OUT').reduce((sum: number, entry: any) => sum + Number(entry.amount || 0), 0);
      return { cashIn, cashOut, balance: cashIn - cashOut, entryCount: entries.length };
    }
    return this.cashbookService.summary(periodId, filters.branchId);
  }

  @Get(':id')
  @Roles(...CASHBOOK_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const entry = await this.cashbookService.findOne(id);
    await this.accessScope.assertBranch(req.user, entry.branchId);
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
