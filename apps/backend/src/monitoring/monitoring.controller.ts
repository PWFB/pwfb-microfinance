import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { MonitoringService } from './monitoring.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.monitoringService.dashboard();
  }

  @Get('staff-status')
  staffStatus() {
    return this.monitoringService.staffStatus();
  }

  @Get('loan-statuses')
  loanStatuses() {
    return this.monitoringService.loanStatuses();
  }

  @Get('recent-transactions')
  recentTransactions() {
    return this.monitoringService.recentTransactions();
  }

  @Get('departments')
  departments() {
    return this.monitoringService.departments();
  }

  @Get('branches')
  branches() {
    return this.monitoringService.branches();
  }
}
