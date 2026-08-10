import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import { HumanResourcesService } from './human-resources.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('human-resources')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class HumanResourcesController {
  constructor(
    private readonly humanResourcesService: HumanResourcesService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.humanResourcesService.dashboard();
  }

  @Get('employees')
  employees() {
    return this.humanResourcesService.employees();
  }

  @Get('employees/active')
  activeEmployees() {
    return this.humanResourcesService.activeEmployees();
  }

  @Get('employees/:id')
  employee(@Param('id') id: string) {
    return this.humanResourcesService.employee(id);
  }

  @Get('departments')
  departments() {
    return this.humanResourcesService.departments();
  }

  @Get('branches')
  branches() {
    return this.humanResourcesService.branches();
  }
}
