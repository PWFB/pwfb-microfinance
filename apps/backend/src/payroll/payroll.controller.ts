import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const PAYROLL_VIEW_ROLES = ['SUPER_ADMIN'];

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() body: { periodId: string; branchId?: string }) { return this.payrollService.create(body); }

  @Get()
  @Roles(...PAYROLL_VIEW_ROLES)
  findAll() { return this.payrollService.findAll(); }

  @Get('summary')
  @Roles(...PAYROLL_VIEW_ROLES)
  summary(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) { return this.payrollService.summary(periodId, branchId); }

  @Get('head-office-balance')
  @Roles('SUPER_ADMIN')
  headOfficeBalance() { return this.payrollService.headOfficeBalance(); }

  @Get(':id')
  @Roles(...PAYROLL_VIEW_ROLES)
  findOne(@Param('id') id: string) { return this.payrollService.findOne(id); }

  @Post(':id/items')
  @Roles('SUPER_ADMIN')
  addItem(@Param('id') id: string, @Body() body: { staffId: string; basicSalary?: number; allowances?: number; deductions?: number }) { return this.payrollService.addItem(id, body); }

  @Patch(':id/approve')
  @Roles('SUPER_ADMIN')
  approve(@Param('id') id: string) { return this.payrollService.approve(id); }

  @Patch(':id/pay')
  @Roles('SUPER_ADMIN')
  markPaid(@Param('id') id: string) { return this.payrollService.markPaid(id); }
}
