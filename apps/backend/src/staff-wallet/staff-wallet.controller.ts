import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffWalletService } from './staff-wallet.service';
import { TwoFactorService } from '../auth/two-factor.service';

@Controller('staff-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class StaffWalletController {
  constructor(private readonly service: StaffWalletService, private readonly twoFactorService: TwoFactorService) {}

  private async requireFinancialMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Get()
  list(@Query('branchId') branchId?: string) { return this.service.list(branchId); }

  @Get(':staffId')
  get(@Param('staffId') staffId: string) { return this.service.get(staffId); }

  @Get(':staffId/history')
  history(@Param('staffId') staffId: string) { return this.service.history(staffId); }

  @Post('issue')
  async issue(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }, @Req() req: any) {
    await this.requireFinancialMfa(req);
    return this.service.credit(body.staffId, body.amount, body.reference, body.description);
  }

  @Post('settle')
  async settle(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }, @Req() req: any) {
    await this.requireFinancialMfa(req);
    return this.service.debit(body.staffId, body.amount, body.reference, body.description);
  }
}
