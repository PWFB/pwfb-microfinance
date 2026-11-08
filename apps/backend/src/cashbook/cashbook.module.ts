import { Module } from '@nestjs/common';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';

@Module({
  controllers: [CashbookController],
  providers: [CashbookService]
})
export class CashbookModule {}
