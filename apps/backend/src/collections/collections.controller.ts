import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from '../permissions/permissions.service';

const VIEW_ROLES = ['SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];
const SETTLE_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'];

@Controller('collections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService, private readonly permissions: PermissionsService) {}

  @Post()
  @Roles(...SETTLE_ROLES)
  async create(@Req() req:any,@Body() body: { periodId: string; branchId: string; staffId: string; customerId: string; type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER'; amount: number; reference?: string; notes?: string; collectionDate?: string; settleNow?: boolean }) {
    await this.permissions.assert(req.user.role,'COLLECTION_CREATE');
    return this.collectionsService.create(body);
  }

  @Get()
  @Roles(...VIEW_ROLES)
  findAll(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string, @Query('type') type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER') {
    return this.collectionsService.findAll(periodId, branchId, staffId, type);
  }

  @Get('summary')
  @Roles(...VIEW_ROLES)
  summary(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('staffId') staffId?: string) {
    return this.collectionsService.summary(periodId, branchId, staffId);
  }

  @Get('daily/:date')
  @Roles(...VIEW_ROLES)
  dailySummary(@Param('date') date: string, @Query('branchId') branchId?: string) {
    return this.collectionsService.dailySummary(date, branchId);
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
