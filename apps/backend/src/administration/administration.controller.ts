import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';

import { AdministrationService } from './administration.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('administration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class AdministrationController {
  constructor(
    private readonly administrationService: AdministrationService,
  ) {}

  @Get('overview')
  overview() {
    return this.administrationService.overview();
  }

  @Get('users')
  users() {
    return this.administrationService.getUsers();
  }

  @Get('staff')
  staff() {
    return this.administrationService.getStaff();
  }

  @Get('departments')
  departments() {
    return this.administrationService.getDepartments();
  }

  @Get('departments/:id')
  department(@Param('id') id: string) {
    return this.administrationService.getDepartment(id);
  }

  @Get('branches')
  branches() {
    return this.administrationService.getBranches();
  }

  @Get('branches/:id')
  branch(@Param('id') id: string) {
    return this.administrationService.getBranch(id);
  }
}
