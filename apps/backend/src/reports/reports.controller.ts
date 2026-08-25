import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const REPORT_VIEW_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'REGIONAL_MANAGER',
  'DIVISIONAL_MANAGER',
  'MONITORING_TEAM',
  'AUDITOR',
  'AREA_MANAGER',
  'BRANCH_MANAGER',
  'CREDIT_OFFICER',
  'LOAN_OFFICER',
  'TELLER',
  'STAFF',
];

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles(...REPORT_VIEW_ROLES)
  getSummary(@Req() req: any) {
    return this.reportsService.getSummary(req.user);
  }

  @Get('operations')
  @Roles(...REPORT_VIEW_ROLES)
  getOperations(@Req() req: any, @Query() query: Record<string, string>) {
    return this.reportsService.getOperations(query, req.user);
  }
}
