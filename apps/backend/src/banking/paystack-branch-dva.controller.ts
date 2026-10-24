import { Body, Controller, Headers, Param, Post, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PaystackBranchDvaService } from './paystack-branch-dva.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class PaystackBranchDvaController {
  constructor(private readonly service: PaystackBranchDvaService, private readonly personalAccounts: CustomerVirtualAccountService) {}

  @Get('banking/branches/paystack/virtual-accounts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'AUDITOR')
  list() { return this.service.list(); }

  @Post('banking/branches/:branchId/paystack/virtual-account')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  provision(@Param('branchId') branchId: string, @Body() body: any) {
    return this.service.provision(branchId, body);
  }

  @Post('webhooks/paystack/branch-dva')
  async webhook(@Headers('x-paystack-signature') signature: string, @Req() req: any, @Body() body: any) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody || !this.service.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }
    const branchResult = await this.service.handleWebhook(body);
    const personalResult = await this.personalAccounts.handleAssignmentWebhook(body);
    return { branch: branchResult, personalAccounts: personalResult };
  }
}
