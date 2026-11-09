import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post()
  create(@Body() body: { periodId: string; branchId?: string }) { return this.payrollService.create(body); }

  @Get()
  findAll() { return this.payrollService.findAll(); }

  @Get('summary')
  summary(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) { return this.payrollService.summary(periodId, branchId); }

  @Get('head-office-balance')
  headOfficeBalance() { return this.payrollService.headOfficeBalance(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.payrollService.findOne(id); }

  @Post(':id/items')
  addItem(@Param('id') id: string, @Body() body: { staffId: string; basicSalary?: number; allowances?: number; deductions?: number }) { return this.payrollService.addItem(id, body); }

  @Patch(':id/approve')
  approve(@Param('id') id: string) { return this.payrollService.approve(id); }

  @Patch(':id/pay')
  markPaid(@Param('id') id: string) { return this.payrollService.markPaid(id); }
}
