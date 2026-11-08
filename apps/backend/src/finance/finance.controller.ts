import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import { FinanceService } from './finance.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.financeService.dashboard();
  }

  @Get('savings')
  savings() {
    return this.financeService.savingsSummary();
  }

  @Get('loans')
  loans() {
    return this.financeService.loansSummary();
  }

  @Get('repayments')
  repayments() {
    return this.financeService.repaymentsSummary();
  }

  @Get('recent-transactions')
  recentTransactions() {
    return this.financeService.recentTransactions();
  }
}
