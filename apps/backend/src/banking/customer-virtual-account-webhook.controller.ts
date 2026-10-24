import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { UnauthorizedException } from '@nestjs/common';

/**
 * Provider-neutral webhook boundary plus the real Flutterwave webhook entrypoint.
 *
 * Provider webhooks are not JWT-authenticated. Flutterwave requests are verified
 * with FLUTTERWAVE_WEBHOOK_SECRET_HASH against the exact raw request body.
 */
@Controller('webhooks/virtual-accounts')
export class CustomerVirtualAccountWebhookController {
  constructor(private readonly service: CustomerVirtualAccountWebhookService, private readonly customerVirtualAccounts: CustomerVirtualAccountService) {}

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
   * Flutterwave DVA/static-account credit notification.
   *
   * Flutterwave signs the raw request body. The service validates the signature,
   * accepts only successful NGN credits, resolves the destination virtual
   * account, and credits the customer's wallet exactly once.
   */
  /**
   * Paystack DVA assignment/identity callbacks. Validate Paystack's HMAC-SHA512
   * signature against the exact raw request bytes before changing account state.
   */
  @Post('paystack')
  paystack(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const rawBody = req.rawBody;
    if (!Buffer.isBuffer(rawBody) || !this.customerVirtualAccounts.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid Paystack webhook signature');
    }
    return this.customerVirtualAccounts.handleAssignmentWebhook(body);
  }

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
