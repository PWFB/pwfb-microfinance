import { Module } from '@nestjs/common';
import { CashbookController } from './cashbook.controller';
import { CashbookService } from './cashbook.service';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [AuthModule, PermissionsModule],
  controllers: [CashbookController],
  providers: [CashbookService]
})
export class CashbookModule {}
