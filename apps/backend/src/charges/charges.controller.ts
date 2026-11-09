import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ChargesService } from './charges.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const CHARGE_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'AREA_MANAGER',
  'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF',
];

@Controller('charges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChargesController {
  constructor(private readonly charges: ChargesService) {}

  @Get('registration')
  @Roles(...CHARGE_ROLES)
  getRegistrationCharge() {
    return this.charges.getRegistrationCharge();
  }

  @Post('registration/collect')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  collectRegistrationFee(
    @Body() body: { reference: string; paymentMethod: 'CASH' | 'BANK_TRANSFER'; confirmedReceived: boolean; branchId?: string; staffId?: string },
    @Req() req: any,
  ) {
    return this.charges.collectRegistrationFee(body, req.user);
  }

  @Patch('registration')
  @Roles('SUPER_ADMIN')
  updateRegistrationCharge(
    @Body() body: { amount: number; reason: string },
    @Req() req: any,
  ) {
    return this.charges.updateRegistrationCharge(body?.amount, body?.reason, req.user);
  }

  @Get('registration/audit')
  @Roles('SUPER_ADMIN')
  listRegistrationChargeAudit(@Req() req: any) {
    return this.charges.listRegistrationChargeAudit(req.user);
  }
}
