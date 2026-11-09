import { Controller, Get, Param, Query, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { DashboardsService } from './dashboards.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

const BRANCH_DASHBOARD_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER',
  'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER',
  'LOAN_OFFICER', 'STAFF', 'AUDITOR', 'MONITORING_TEAM',
];

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService, private readonly accessScope: AccessScopeService) {}

  @Get('branch/:branchId')
  @Roles(...BRANCH_DASHBOARD_ROLES)
  async branchSummary(@Param('branchId') branchId: string, @Query('periodId') periodId?: string, @Req() req?: any) {
    if (!req?.user) throw new ForbiddenException('Authentication is required.');
    await this.accessScope.assertBranch(req.user, branchId);
    return this.dashboardsService.branchSummary(branchId, periodId);
  }

  @Get('co')
  @Roles('SUPER_ADMIN')
  coSummary(@Query('periodId') periodId?: string) {
    return this.dashboardsService.coSummary(periodId);
  }
}
