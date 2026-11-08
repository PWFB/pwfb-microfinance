import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AccessScopeService } from '../access/access-scope.service';

@Controller('charges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChargesController {
  constructor(private readonly charges: ChargesService, private readonly scope: AccessScopeService) {}

  @Get()
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','AREA_MANAGER','DIVISIONAL_MANAGER','REGIONAL_MANAGER','CREDIT_OFFICER','LOAN_OFFICER','STAFF')
  list() { return this.charges.list(); }

  @Get('client-registration/history')
  @Roles('SUPER_ADMIN')
  history() { return this.charges.history('CLIENT_REGISTRATION'); }

  @Patch('client-registration')
  @Roles('SUPER_ADMIN')
  updateClientRegistration(@Body() body: { amount: number; note?: string }, @Req() req: any) {
    return this.charges.updateClientRegistrationCharge(body?.amount, body?.note || '', req.user);
  }

  @Get('registration-receipts')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','AREA_MANAGER','DIVISIONAL_MANAGER','REGIONAL_MANAGER','CREDIT_OFFICER')
  async registrationReceipts(@Req() req: any) {
    const access = await this.scope.getScope(req.user);
    const branchIds = access.global ? null : await this.scope.getBranchIds(req.user);
    if (!access.global && !branchIds?.length) return [];
    return this.charges.listRegistrationReceipts(branchIds, access.role === 'CREDIT_OFFICER' ? access.staffId || undefined : undefined);
  }

}
