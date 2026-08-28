import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CashbookService, CashbookDailyInput } from './cashbook.service';

@Controller('cashbook')
export class CashbookController {
  constructor(private readonly cashbookService: CashbookService) {}

  @Post()
  create(@Body() body: {
    periodId: string;
    branchId: string;
    type: 'CASH_IN' | 'CASH_OUT';
    amount: number;
    reference?: string;
    description?: string;
    entryDate?: string;
  }) {
    return this.cashbookService.create(body);
  }

  @Get('daily/summary')
  dailySummary(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashbookService.dailySummary(periodId, branchId, from, to);
  }

  @Get('daily')
  findDaily(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cashbookService.findDaily(periodId, branchId, from, to);
  }

  @Post('daily')
  createDaily(@Body() body: CashbookDailyInput) {
    return this.cashbookService.createDaily(body);
  }

  @Patch('daily/:id')
  updateDaily(@Param('id') id: string, @Body() body: Partial<CashbookDailyInput>) {
    return this.cashbookService.updateDaily(id, body);
  }

  @Delete('daily/:id')
  removeDaily(@Param('id') id: string) {
    return this.cashbookService.removeDaily(id);
  }

  @Get()
  findAll(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.cashbookService.findAll(periodId, branchId);
  }

  @Get('summary')
  summary(@Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.cashbookService.summary(periodId, branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.cashbookService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.cashbookService.remove(id);
  }
}
