import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { PaystackBranchDvaService } from './paystack-branch-dva.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller()
export class PaystackController {
  constructor(private readonly paystackService: PaystackService, private readonly branchDvaService: PaystackBranchDvaService) {}

  @Post('banking/paystack/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  testConnection() { return this.paystackService.testConnection(); }

  @Post('banking/customers/:customerId/paystack/initialize')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CUSTOMER_SERVICE', 'STAFF', 'CUSTOMER')
  initializePayment(@Param('customerId') customerId: string, @Body() body: { amount: number }, @Req() req: any) {
    if (req.user?.role === 'CUSTOMER' && (!req.user.customerId || req.user.customerId !== customerId)) throw new UnauthorizedException('You can only create payments for your own customer account');
    return this.paystackService.initializeCustomerPayment(customerId, body?.amount);
  }

  @Post('banking/paystack/verify/:reference')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CUSTOMER_SERVICE', 'STAFF', 'CUSTOMER')
  verifyPayment(@Param('reference') reference: string) { return this.paystackService.verifyAndCredit(reference); }

  @Post('webhooks/paystack')
  async webhook(@Headers('x-paystack-signature') signature: string, @Req() req: any, @Body() body: any) {
    const rawBody = req.rawBody as Buffer | undefined;
    if (!rawBody || !this.paystackService.verifyWebhookSignature(rawBody, signature)) throw new UnauthorizedException('Invalid Paystack webhook signature');
    const event = String(body?.event || '');
    const dedicated = event.startsWith('dedicatedaccount.') || event === 'customeridentification.success' || event === 'customeridentification.failed' || body?.data?.authorization?.channel === 'dedicated_nuban';
    return dedicated ? this.branchDvaService.handleWebhook(body) : this.paystackService.handleWebhook(body);
  }
}
