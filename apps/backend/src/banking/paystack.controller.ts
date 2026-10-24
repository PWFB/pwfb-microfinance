import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { PaystackBranchDvaService } from './paystack-branch-dva.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class PaystackController {
  constructor(private readonly paystackService: PaystackService, private readonly branchDvaService: PaystackBranchDvaService, private readonly customerVirtualAccountService: CustomerVirtualAccountService) {}

  @Post('banking/customers/:customerId/paystack/card-charge')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER')
  chargeAtmCard(@Param('customerId') customerId: string, @Body() body: any, @Req() req: any) {
    if (req.user?.role === 'CUSTOMER' && (!req.user.customerId || req.user.customerId !== customerId)) throw new UnauthorizedException('You can only create payments for your own customer account');
    return this.paystackService.chargeCustomerAtmCard(customerId, body);
  }

  @Post('banking/customers/:customerId/paystack/card-charge-saved')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER')
  chargeSavedAtmCard(@Param('customerId') customerId: string, @Body() body: { cardId: string; amount: number }, @Req() req: any) {
    if (req.user?.role === 'CUSTOMER' && (!req.user.customerId || req.user.customerId !== customerId)) throw new UnauthorizedException('You can only create payments for your own customer account');
    return this.paystackService.chargeCustomerWithSavedAuthorization(customerId, String(body?.cardId || ''), body?.amount);
  }

  @Post('banking/paystack/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  testConnection() { return this.paystackService.testConnection(); }

  @Post('banking/customers/:customerId/paystack/initialize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER')
  initializePayment(@Param('customerId') customerId: string, @Body() body: { amount: number }, @Req() req: any) {
    if (req.user?.role === 'CUSTOMER' && (!req.user.customerId || req.user.customerId !== customerId)) throw new UnauthorizedException('You can only create payments for your own customer account');
    return this.paystackService.initializeCustomerPayment(customerId, body?.amount);
  }

  @Post('banking/paystack/verify/:reference')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER')
  verifyPayment(@Param('reference') reference: string, @Req() req: any) { return this.paystackService.verifyAndCredit(reference, req.user); }

  @Post('webhooks/paystack')
  async webhook(@Headers('x-paystack-signature') signature: string, @Req() req: any, @Body() body: any) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody || !this.paystackService.verifyWebhookSignature(rawBody, signature)) throw new UnauthorizedException('Invalid Paystack webhook signature');
    const event = String(body?.event || '');
    const dedicatedAssignment = event.startsWith('dedicatedaccount.') || event === 'customeridentification.success' || event === 'customeridentification.failed';
    const dedicatedDeposit = body?.data?.authorization?.channel === 'dedicated_nuban';

    if (dedicatedAssignment) {
      // Reconcile customer/staff accounts and branch accounts independently.
      // Both handlers are idempotent and only persist provider-returned account details.
      const customerStaffResult = await this.customerVirtualAccountService.handleAssignmentWebhook(body);
      const branchResult = await this.branchDvaService.handleWebhook(body);
      return { ok: true, event, customerStaff: customerStaffResult, branch: branchResult };
    }

    if (dedicatedDeposit) {
      // Preserve the existing branch ledger reconciliation for branch-level DVAs.
      return this.branchDvaService.handleWebhook(body);
    }

    return this.paystackService.handleWebhook(body);
  }
}
