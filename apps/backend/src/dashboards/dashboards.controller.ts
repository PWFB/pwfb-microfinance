import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
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
  coSummary(@Query('periodId') periodId?: string) {
    return this.dashboardsService.coSummary(periodId);
  }
}
