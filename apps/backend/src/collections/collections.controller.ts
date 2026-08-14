import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly collectionsService: CollectionsService,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      periodId: string;
      branchId: string;
      staffId: string;
      customerId: string;
      type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER';
      amount: number;
      reference?: string;
      notes?: string;
      collectionDate?: string;
    },
  ) {
    return this.collectionsService.create(body);
  }

  @Get()
  findAll(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
    @Query('type')
    type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER',
  ) {
    return this.collectionsService.findAll(
      periodId,
      branchId,
      staffId,
      type,
    );
  }

  @Get('summary')
  summary(
    @Query('periodId') periodId?: string,
    @Query('branchId') branchId?: string,
    @Query('staffId') staffId?: string,
  ) {
    return this.collectionsService.summary(
      periodId,
      branchId,
      staffId,
    );
  }

  @Get('daily/:date')
  dailySummary(
    @Param('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.collectionsService.dailySummary(
      date,
      branchId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.collectionsService.findOne(id);
  }

  @Patch(':id/reconcile')
  reconcile(@Param('id') id: string) {
    return this.collectionsService.reconcile(id);
  }

  @Patch(':id/unreconcile')
  unreconcile(@Param('id') id: string) {
    return this.collectionsService.unreconcile(id);
  }
}
