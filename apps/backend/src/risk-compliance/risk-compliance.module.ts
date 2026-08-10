import { Module } from '@nestjs/common';

import { RiskComplianceController } from './risk-compliance.controller';
import { RiskComplianceService } from './risk-compliance.service';

@Module({
  controllers: [RiskComplianceController],
  providers: [RiskComplianceService],
  exports: [RiskComplianceService],
})
export class RiskComplianceModule {}
