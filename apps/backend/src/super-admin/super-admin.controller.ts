import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { SuperAdminService } from './super-admin.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('super-admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.superAdminService.dashboard();
  }

  @Get('system-stats')
  systemStats() {
    return this.superAdminService.systemStats();
  }

  @Get('financial-stats')
  financialStats() {
    return this.superAdminService.financialStats();
  }

  @Get('staff-stats')
  staffStats() {
    return this.superAdminService.staffStats();
  }
}
