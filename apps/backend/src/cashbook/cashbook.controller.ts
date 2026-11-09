import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import type { CashbookDailyInput } from './cashbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF','AUDITOR'];

@Controller('cashbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashbookController {
  constructor(private readonly cashbookService: CashbookService, private readonly accessScope: AccessScopeService) {}

  private async scopedBranch(user: any, requestedBranchId?: string) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return requestedBranchId;
    if (!scope.branchId) throw new ForbiddenException('Your staff account has no assigned branch');
    if (requestedBranchId && requestedBranchId !== scope.branchId) {
      await this.accessScope.assertBranch(user, requestedBranchId);
    }
    if (scope.role !== 'AREA_MANAGER' && scope.role !== 'DIVISIONAL_MANAGER' && scope.role !== 'REGIONAL_MANAGER') {
      return scope.branchId;
    }
    return requestedBranchId;
  }

  private async visibleDaily(user: any, filters: { periodId?: string; branchId?: string; from?: string; to?: string }) {
    const rows = await this.cashbookService.findDaily(filters.periodId, filters.branchId, filters.from, filters.to);
    return this.accessScope.filterList(user, 'cashbook_daily', rows);
  }

  private async visibleEntries(user: any, periodId?: string, branchId?: string) {
    const rows = await this.cashbookService.findAll(periodId, branchId);
    return this.accessScope.filterList(user, 'cashbook_entries', rows);
  }

  @Post()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER')
  async create(@Body() body: {
    periodId: string; branchId: string; type: 'CASH_IN' | 'CASH_OUT'; amount: number;
    reference?: string; description?: string; entryDate?: string;
  }, @Req() req: any) {
    const branchId = await this.scopedBranch(req.user, body.branchId);
    if (!branchId) throw new ForbiddenException('A branch must be selected');
    return this.cashbookService.create({ ...body, branchId });
  }

  @Get('daily/summary')
  @Roles(...VIEW_ROLES)
  async dailySummary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const scopedBranch = await this.scopedBranch(req.user, branchId);
    const rows = await this.visibleDaily(req.user, { periodId, branchId: scopedBranch, from, to });
    const money = ['previousCashAtHand','savingsDeposits','dailyCollection','weeklyCollection','monthlyCollection','monitorRegistrationFees','riskPremium','passbookSales','loanApplicationForm','withdrawalFromBank','fundReceivedHeadOffice','fundReceivedBranchOther','receiptOthers','fixedOther','otherIncome','dailyDisbursementAmount','weeklyDisbursementAmount','monthlyDisbursementAmount','bankDeposit','savingsWithdrawalAmount','savingsReturnedDW','savingsReturnedD','savingsReturnedW','savingsReturnedCash','savingsReturnedAdjust','fundTransferHeadOffice','fundTransferBranch','others','otherAfterTotal'];
    const counts = ['dailyDisbursementCount','weeklyDisbursementCount','monthlyDisbursementCount','savingsWithdrawalCount'];
    const totals: Record<string, number> = { records: rows.length };
    for (const field of [...money, ...counts]) totals[field] = rows.reduce((sum: number, row: any) => sum + Number(row[field] || 0), 0);
    totals.totalReceipts = rows.reduce((sum: number, row: any) => sum + Number(row.totalReceipts || 0), 0);
    totals.totalPayments = rows.reduce((sum: number, row: any) => sum + Number(row.totalPayments || 0), 0);
    totals.netAmount = totals.totalReceipts - totals.totalPayments;
    return totals;
  }

  @Get('daily')
  @Roles(...VIEW_ROLES)
  async findDaily(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const scopedBranch = await this.scopedBranch(req.user, branchId);
    return this.visibleDaily(req.user, { periodId, branchId: scopedBranch, from, to });
  }

  @Post('daily')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF')
  async createDaily(@Body() body: CashbookDailyInput, @Req() req: any) {
    const scope = await this.accessScope.getScope(req.user);
    const branchId = await this.scopedBranch(req.user, body.branchId);
    if (!branchId) throw new ForbiddenException('Your staff account must be assigned to a branch before posting daily cashbook work');
    const staffId = scope.global ? body.staffId : scope.staffId;
    if (!scope.global && !staffId) throw new ForbiddenException('Your login is not linked to an assigned staff record');
    return this.cashbookService.createDaily({ ...body, branchId, staffId });
  }

  @Patch('daily/:id')
  @Roles('SUPER_ADMIN','ADMIN')
  async updateDaily(@Param('id') id: string, @Body() body: Partial<CashbookDailyInput>, @Req() req: any) {
    const visible = await this.visibleDaily(req.user, {});
    if (!visible.some((row: any) => row.id === id)) throw new ForbiddenException('Cashbook record is outside your access scope');
    return this.cashbookService.updateDaily(id, body);
  }

  @Delete('daily/:id')
  @Roles('SUPER_ADMIN','ADMIN')
  async removeDaily(@Param('id') id: string, @Req() req: any) {
    const visible = await this.visibleDaily(req.user, {});
    if (!visible.some((row: any) => row.id === id)) throw new ForbiddenException('Cashbook record is outside your access scope');
    return this.cashbookService.removeDaily(id);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  async findAll(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const scopedBranch = await this.scopedBranch(req.user, branchId);
    return this.visibleEntries(req.user, periodId, scopedBranch);
  }

  @Get('summary')
  @Roles(...VIEW_ROLES)
  async summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    const rows = await this.visibleEntries(req.user, periodId, await this.scopedBranch(req.user, branchId));
    const cashIn = rows.filter((row: any) => row.type === 'CASH_IN').reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    const cashOut = rows.filter((row: any) => row.type === 'CASH_OUT').reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
    return { cashIn, cashOut, balance: cashIn - cashOut, entryCount: rows.length };
  }

  @Get(':id')
  @Roles(...VIEW_ROLES)
  async findOne(@Param('id') id: string, @Req() req: any) {
    const entry = await this.cashbookService.findOne(id);
    const visible = await this.accessScope.filterList(req.user, 'cashbook_entries', [entry]);
    if (!visible.length) throw new ForbiddenException('Cashbook entry is outside your access scope');
    return entry;
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN','ADMIN')
  async remove(@Param('id') id: string, @Req() req: any) {
    const visible = await this.accessScope.filterList(req.user, 'cashbook_entries', [await this.cashbookService.findOne(id)]);
    if (!visible.length) throw new ForbiddenException('Cashbook entry is outside your access scope');
    return this.cashbookService.remove(id);
  }
}
