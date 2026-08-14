import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CashbookService } from './cashbook.service';

@Controller('cashbook')
export class CashbookController {
  constructor(
    private readonly cashbookService: CashbookService,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      periodId: string;
      branchId: string;
      type: 'CASH_IN' | 'CASH_OUT';
      amount: number;
      reference?: string;
      description?: string;
      entryDate?: string;
    },
  ) {
    return this.cashbookService.create(body);
  }

  @Get()
  findAll(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.cashbookService.findAll(
      periodId,
      branchId,
    );
  }

  @Get('summary')
  summary(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.cashbookService.summary(
      periodId,
      branchId,
    );
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
