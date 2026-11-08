import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FinancialPortalService } from './financial-portal.service';

@Controller('financial-portal')
export class FinancialPortalController {
  constructor(private readonly service: FinancialPortalService) {}

  @Get('payroll')
  payroll(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string, @Query('query') query?: string) {
    return this.service.payroll(periodId, branchId, query);
  }

  @Get('payroll/summary')
  payrollSummary(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.service.payrollSummary(periodId, branchId);
  }

  @Get('disbursements')
  disbursements(@Query('batchReference') batchReference?: string, @Query('status') status?: string) {
    return this.service.disbursements(batchReference, status);
  }

  @Post('disbursements')
  createDisbursement(@Body() body: {
    staffId: string; payrollId?: string; bankCode: string; bankName: string;
    accountNumber: string; accountName: string; amount: number;
    narration?: string; reference?: string; batchReference?: string; scheduledDate?: string;
  }) {
    return this.service.createDisbursement(body);
  }

  @Get('cooperative')
  cooperative(@Query('query') query?: string) {
    return this.service.cooperative(query);
  }

  @Get('dashboard')
  dashboard(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.service.dashboard(periodId, branchId);
  }
}
