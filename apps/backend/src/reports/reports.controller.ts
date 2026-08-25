import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { ReportsService } from './reports.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
  ) {}

  @Get('summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'AUDITOR')
  getSummary() {
    return this.reportsService.getSummary();
  }

  @Get('operations')
  @Roles('SUPER_ADMIN', 'ADMIN')
  getOperations() {
    return this.reportsService.getOperations();
  }
}
