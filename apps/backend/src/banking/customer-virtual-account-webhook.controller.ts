import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';

/**
 * Provider-neutral webhook boundary.
 *
 * A real DVA provider should map its webhook payload into these two contracts.
 * The endpoint is intentionally outside JWT auth because bank/provider webhooks
 * cannot authenticate as a PWFB customer. Every request must carry the shared
 * PWFB_VIRTUAL_ACCOUNT_WEBHOOK_SECRET header.
 */
@Controller('webhooks/virtual-accounts')
export class CustomerVirtualAccountWebhookController {
  constructor(private readonly service: CustomerVirtualAccountWebhookService) {}

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
}
