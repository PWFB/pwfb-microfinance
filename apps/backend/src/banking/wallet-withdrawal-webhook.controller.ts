import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { WalletWithdrawalWebhookService } from './wallet-withdrawal-webhook.service';

@Controller('webhooks/wallet')
export class WalletWithdrawalWebhookController {
  constructor(private readonly service: WalletWithdrawalWebhookService) {}

  @Post('withdrawal')
  reconcile(
    @Headers('x-pwfb-webhook-secret') secret: string,
    @Body() body: {
      transactionReference: string;
      status: 'COMPLETED' | 'FAILED';
      provider?: string;
      providerReference?: string;
      failureReason?: string;
    },
  ) {
    return this.service.reconcile({ ...body, secret });
  }

  @Post('flutterwave')
  reconcileFlutterwave(
    @Headers('flutterwave-signature') signature: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.reconcileFlutterwave({
      body,
      signature,
      rawBody: req.rawBody,
    });
  }
}
