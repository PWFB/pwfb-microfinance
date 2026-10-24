import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';
import { PaystackService } from '../staff/paystack.service';

/**
 * Provider-neutral webhook boundary plus provider-specific webhook entrypoints.
 * Provider callbacks are unauthenticated at the JWT layer but must be verified
 * with the relevant provider signature before any state change is made.
 */
@Controller('webhooks/virtual-accounts')
export class CustomerVirtualAccountWebhookController {
  constructor(
    private readonly service: CustomerVirtualAccountWebhookService,
    private readonly virtualAccounts: CustomerVirtualAccountService,
    private readonly paystack: PaystackService,
  ) {}

  @Post('assign')
  assign(
    @Headers('x-pwfb-webhook-secret') secret: string,
    @Body() body: {
      accountNumber: string;
      accountName?: string;
      provider?: string;
      providerReference?: string;
      institutionId?: string;
      customerId?: string;
      branchId?: string;
      status?: 'ACTIVE' | 'FAILED' | 'INACTIVE';
      failureReason?: string;
    },
  ) {
    return this.service.assign({ ...body, secret });
  }

  @Post('deposit')
  deposit(
    @Headers('x-pwfb-webhook-secret') secret: string,
    @Body() body: {
      accountNumber: string;
      amount: number;
      provider?: string;
      providerReference: string;
      description?: string;
    },
  ) {
    return this.service.deposit({ ...body, secret });
  }

  /**
   * Paystack sends identity-validation and DVA-assignment events asynchronously.
   * Verify the HMAC against Nest's exact raw request body before processing them.
   */
  @Post('paystack')
  async paystackAssignment(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const rawBody = req?.rawBody;
    if (!Buffer.isBuffer(rawBody) || !this.paystack.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }
    return this.virtualAccounts.handleAssignmentWebhook(body);
  }

  /**
   * Flutterwave DVA/static-account credit notification.
   * The service validates Flutterwave's signature against the exact raw body,
   * accepts only successful NGN credits, and credits the wallet exactly once.
   */
  @Post('flutterwave')
  flutterwave(
    @Headers('flutterwave-signature') signature: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.depositFlutterwave({
      body,
      signature,
      rawBody: req.rawBody,
    });
  }
}
