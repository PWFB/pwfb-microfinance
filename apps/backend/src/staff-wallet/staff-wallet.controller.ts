import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffWalletService } from './staff-wallet.service';

@Controller('staff-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
export class StaffWalletController {
  constructor(private readonly service: StaffWalletService) {}

  @Get()
  list(@Req() req: any, @Query('branchId') branchId?: string) { return this.service.list(req.user, branchId); }
  @Get(':staffId')
  get(@Req() req: any, @Param('staffId') staffId: string) { return this.service.get(staffId, req.user); }
  @Get(':staffId/history')
  history(@Req() req: any, @Param('staffId') staffId: string) { return this.service.history(staffId, req.user); }
  @Post('issue')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  issue(@Req() req: any, @Body() body: { staffId: string; amount: number; reference?: string; description?: string }) { return this.service.creditForUser(req.user, body.staffId, body.amount, body.reference, body.description); }
  @Post('settle')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER')
  settle(@Req() req: any, @Body() body: { staffId: string; amount: number; reference?: string; description?: string }) { return this.service.debitForUser(req.user, body.staffId, body.amount, body.reference, body.description); }
}
