import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','AUDITOR','MONITORING_TEAM')
export class DashboardsController {
  constructor(
    private readonly dashboardsService: DashboardsService,
  ) {}

  @Get('branch/:branchId')
  branchSummary(
    @Param('branchId') branchId: string,
    @Query('periodId') periodId?: string,
  ) {
    return this.dashboardsService.branchSummary(
      branchId,
      periodId,
    );
  }

  @Get('co')
  @Roles('SUPER_ADMIN')
  coSummary(@Query('periodId') periodId?: string) {
    return this.dashboardsService.coSummary(periodId);
  }
}
