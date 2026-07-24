import { Controller, Get } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  summary() {
    return this.reportsService.getSummary();
  }

  @Get('customers')
  customers() {
    return this.reportsService.customers();
  }

  @Get('savings')
  savings() {
    return this.reportsService.savings();
  }

  @Get('loans')
  loans() {
    return this.reportsService.loans();
  }

  @Get('transactions')
  transactions() {
    return this.reportsService.transactions();
  }

  @Get('repayments')
  repayments() {
    return this.reportsService.repayments();
  }
}
