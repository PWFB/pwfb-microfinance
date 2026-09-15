import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReconciliationService } from './reconciliation.service';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','AUDITOR','MONITORING_TEAM')
export class ReconciliationController {
  constructor(private readonly reconciliation: ReconciliationService) {}
  @Get('summary') summary(@Req() req: any, @Query('periodId') periodId?: string, @Query('branchId') branchId?: string) {
    return this.reconciliation.summary(req.user, periodId, branchId);
  }
}
