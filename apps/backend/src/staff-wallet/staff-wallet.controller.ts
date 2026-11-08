import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StaffWalletService } from './staff-wallet.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { AccessScopeService } from '../access/access-scope.service';

@Controller('staff-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffWalletController {
  constructor(
    private readonly service: StaffWalletService,
    private readonly twoFactorService: TwoFactorService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async requireFinancialMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER')
  async list(@Query('branchId') branchId: string | undefined, @Req() req: any) {
    const scope = await this.accessScope.getScope(req.user);
    const branchIds = scope.global ? null : await this.accessScope.getBranchIds(req.user);
    if (branchId && !scope.global) await this.accessScope.assertBranch(req.user, branchId);
    return this.service.list(branchId, branchIds);
  }

  @Get(':staffId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER')
  async get(@Param('staffId') staffId: string, @Req() req: any) {
    await this.accessScope.assertStaff(req.user, staffId);
    return this.service.get(staffId);
  }

  @Get(':staffId/history')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER')
  async history(@Param('staffId') staffId: string, @Req() req: any) {
    await this.accessScope.assertStaff(req.user, staffId);
    return this.service.history(staffId);
  }

  @Post('issue')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async issue(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }, @Req() req: any) {
    await this.accessScope.assertStaff(req.user, body.staffId);
    await this.requireFinancialMfa(req);
    return this.service.credit(body.staffId, body.amount, body.reference, body.description);
  }

  @Post('settle')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async settle(@Body() body: { staffId: string; amount: number; reference?: string; description?: string }, @Req() req: any) {
    await this.accessScope.assertStaff(req.user, body.staffId);
    await this.requireFinancialMfa(req);
    return this.service.debit(body.staffId, body.amount, body.reference, body.description);
  }
}
