import { Module } from '@nestjs/common';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CashbookController],
  providers: [CashbookService]
})
export class CashbookModule {}
