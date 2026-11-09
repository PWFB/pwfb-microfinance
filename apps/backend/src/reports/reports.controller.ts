import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'AUDITOR')
  getSummary(@Req() req: any) {
    return this.reportsService.getSummary(req.user);
  }

  @Get('operations')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'AUDITOR')
  getOperations(@Query() query: Record<string, string>, @Req() req: any) {
    return this.reportsService.getOperations(query, req.user);
  }
}
