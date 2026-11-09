import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import type { CashbookDailyInput } from './cashbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

type CashbookRequest = { user: { id: string; role: string; staffId?: string | null } };
const CASHBOOK_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'AREA_MANAGER', 'DIVISIONAL_MANAGER', 'REGIONAL_MANAGER',
  'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF', 'AUDITOR', 'MONITORING_TEAM',
];
const CASHBOOK_WRITE_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'AREA_MANAGER', 'DIVISIONAL_MANAGER', 'REGIONAL_MANAGER',
  'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF',
];

@Controller('cashbook')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashbookController {
  constructor(private readonly cashbookService: CashbookService) {}

  @Get('access')
  @Roles(...CASHBOOK_ROLES)
  access(@Req() request: CashbookRequest) {
    return this.cashbookService.getAccess(request.user);
  }

  @Get('daily/opening-balance')
  @Roles(...CASHBOOK_WRITE_ROLES)
  openingBalance(
    @Req() request: CashbookRequest,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('entryDate') entryDate?: string,
  ) {
    return this.cashbookService.getOpeningBalance(request.user, branchId, staffId, entryDate);
  }

  @Post()
  @Roles(...CASHBOOK_WRITE_ROLES)
  create(@Req() request: CashbookRequest, @Body() body: {
    periodId: string; branchId: string; type: 'CASH_IN' | 'CASH_OUT'; amount: number;
    reference?: string; description?: string; entryDate?: string;
  }) {
    return this.cashbookService.create(body, request.user);
  }

  @Get('daily/summary')
  @Roles(...CASHBOOK_ROLES)
  dailySummary(
    @Req() request: CashbookRequest,
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashbookService.dailySummary(periodId, branchId, from, to, request.user);
  }

  @Get('daily')
  @Roles(...CASHBOOK_ROLES)
  findDaily(
    @Req() request: CashbookRequest,
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashbookService.findDaily(periodId, branchId, from, to, request.user);
  }

  @Post('daily')
  @Roles(...CASHBOOK_WRITE_ROLES)
  createDaily(@Req() request: CashbookRequest, @Body() body: CashbookDailyInput) {
    return this.cashbookService.createDaily(body, request.user);
  }

  @Patch('daily/:id')
  @Roles(...CASHBOOK_WRITE_ROLES)
  updateDaily(@Req() request: CashbookRequest, @Param('id') id: string, @Body() body: Partial<CashbookDailyInput>) {
    return this.cashbookService.updateDaily(id, body, request.user);
  }

  @Delete('daily/:id')
  @Roles(...CASHBOOK_WRITE_ROLES)
  removeDaily(@Req() request: CashbookRequest, @Param('id') id: string) {
    return this.cashbookService.removeDaily(id, request.user);
  }

  @Get()
  @Roles(...CASHBOOK_ROLES)
  findAll(@Req() request: CashbookRequest, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.cashbookService.findAll(periodId, branchId, request.user);
  }

  @Get('summary')
  @Roles(...CASHBOOK_ROLES)
  summary(@Req() request: CashbookRequest, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.cashbookService.summary(periodId, branchId, request.user);
  }

  @Get(':id')
  @Roles(...CASHBOOK_ROLES)
  findOne(@Req() request: CashbookRequest, @Param('id') id: string) {
    return this.cashbookService.findOne(id, request.user);
  }

  @Delete(':id')
  @Roles(...CASHBOOK_WRITE_ROLES)
  remove(@Req() request: CashbookRequest, @Param('id') id: string) {
    return this.cashbookService.remove(id, request.user);
  }
}
