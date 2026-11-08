import { Module } from '@nestjs/common';
import { FinancialPortalController } from './financial-portal.controller';
import { FinancialPortalService } from './financial-portal.service';

@Module({
  controllers: [FinancialPortalController],
  providers: [FinancialPortalService],
})
export class FinancialPortalModule {}
