import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const PERIOD_VIEW_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER',
  'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER',
  'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF',
];

@Controller('periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() body: { name: string; startDate: string; endDate: string }) {
    return this.periodsService.create(body);
  }

  @Get()
  @Roles(...PERIOD_VIEW_ROLES)
  findAll() {
    return this.periodsService.findAll();
  }

  @Get('current')
  @Roles(...PERIOD_VIEW_ROLES)
  current() {
    return this.periodsService.current();
  }

  @Get(':id/closing-check')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'MONITORING_TEAM')
  closingCheck(@Param('id') id: string, @Req() req: any) {
    return this.periodsService.closingCheck(id, req.user);
  }

  @Get(':id')
  @Roles(...PERIOD_VIEW_ROLES)
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Patch(':id/close')
  @Roles('SUPER_ADMIN', 'ADMIN')
  close(@Param('id') id: string, @Req() req: any) {
    return this.periodsService.close(id, req.user);
  }
}
