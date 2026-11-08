import { Module } from '@nestjs/common';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ReconciliationModule, AuthModule],
  controllers: [PeriodsController],
  providers: [PeriodsService],
})
export class PeriodsModule {}
