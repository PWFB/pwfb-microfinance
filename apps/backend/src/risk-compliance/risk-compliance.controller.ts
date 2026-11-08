import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { RiskComplianceService } from './risk-compliance.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('risk-compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class RiskComplianceController {
  constructor(
    private readonly riskComplianceService: RiskComplianceService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.riskComplianceService.dashboard();
  }

  @Get('loan-risk')
  loanRisk() {
    return this.riskComplianceService.loanRisk();
  }

  @Get('operational-checks')
  operationalChecks() {
    return this.riskComplianceService.operationalChecks();
  }

  @Get('staff-risk')
  staffRisk() {
    return this.riskComplianceService.staffRisk();
  }
}
