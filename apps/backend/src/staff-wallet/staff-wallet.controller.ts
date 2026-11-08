import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffWalletService } from './staff-wallet.service';

@Controller('staff-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'TELLER', 'STAFF')
export class StaffWalletController {
  constructor(private readonly service: StaffWalletService) {}

  @Get()
  list(@Query('branchId') branchId?: string) { return this.service.list(branchId); }
  @Get(':staffId')
  get(@Param('staffId') staffId: string) { return this.service.get(staffId); }
  @Get(':staffId/history')
  history(@Param('staffId') staffId: string) { return this.service.history(staffId); }
  @Post('issue')
  issue(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }) { return this.service.credit(body.staffId, body.amount, body.reference, body.description); }
  @Post('settle')
  settle(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }) { return this.service.debit(body.staffId, body.amount, body.reference, body.description); }
}
