import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'COLLECTOR', 'STAFF', 'TELLER', 'LOAN_OFFICER')
  create(
    @Body() body: {
      periodId?: string;
      branchId?: string;
      staffId?: string;
      customerId: string;
      type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER';
      amount: number;
      paymentMethod?: 'CASH' | 'DEPOSIT';
      reference?: string;
      notes?: string;
      collectionDate?: string;
    },
    @Req() req: any,
  ) {
    return this.collectionsService.create(body, req.user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'COLLECTOR', 'STAFF', 'TELLER', 'LOAN_OFFICER', 'AUDITOR')
  findAll(
    @Query('periodId') periodId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('staffId') staffId: string | undefined,
    @Query('type') type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER' | undefined,
    @Req() req: any,
  ) {
    return this.collectionsService.findAll(periodId, branchId, staffId, type, req.user);
  }

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'COLLECTOR', 'STAFF', 'TELLER', 'LOAN_OFFICER', 'AUDITOR')
  summary(
    @Query('periodId') periodId: string | undefined,
    @Query('branchId') branchId: string | undefined,
    @Query('staffId') staffId: string | undefined,
    @Req() req: any,
  ) {
    return this.collectionsService.summary(periodId, branchId, staffId, req.user);
  }

  @Get('daily/:date')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR')
  dailySummary(@Param('date') date: string, @Query('branchId') branchId: string | undefined, @Req() req: any) {
    return this.collectionsService.dailySummary(date, branchId, req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'COLLECTOR', 'STAFF', 'TELLER', 'LOAN_OFFICER', 'AUDITOR')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.collectionsService.findOne(id, req.user);
  }

  @Patch(':id/reconcile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  reconcile(@Param('id') id: string, @Req() req: any) {
    return this.collectionsService.reconcile(id, req.user);
  }

  @Patch(':id/unreconcile')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  unreconcile(@Param('id') id: string, @Req() req: any) {
    return this.collectionsService.unreconcile(id, req.user);
  }
}
