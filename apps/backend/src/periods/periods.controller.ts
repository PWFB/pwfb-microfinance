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

@Controller('periods')
export class PeriodsController {
  constructor(private readonly periodsService: PeriodsService) {}

  @Post()
  create(@Body() body: { name: string; startDate: string; endDate: string }) {
    return this.periodsService.create(body);
  }

  @Get()
  findAll() {
    return this.periodsService.findAll();
  }

  @Get('current')
  current() {
    return this.periodsService.current();
  }

  @Get(':id/closing-check')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR', 'MONITORING_TEAM')
  closingCheck(@Param('id') id: string, @Req() req: any) {
    return this.periodsService.closingCheck(id, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Patch(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  close(@Param('id') id: string, @Req() req: any) {
    return this.periodsService.close(id, req.user);
  }
}
