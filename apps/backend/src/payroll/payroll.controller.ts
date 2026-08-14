import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';

@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      periodId: string;
      branchId?: string;
    },
  ) {
    return this.payrollService.create(body);
  }

  @Get()
  findAll() {
    return this.payrollService.findAll();
  }

  @Get('summary')
  summary(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.payrollService.summary(
      periodId,
      branchId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Post(':id/items')
  addItem(
    @Param('id') id: string,
    @Body()
    body: {
      staffId: string;
      basicSalary?: number;
      allowances?: number;
      deductions?: number;
    },
  ) {
    return this.payrollService.addItem(id, body);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.payrollService.approve(id);
  }

  @Patch(':id/pay')
  markPaid(@Param('id') id: string) {
    return this.payrollService.markPaid(id);
  }
}
