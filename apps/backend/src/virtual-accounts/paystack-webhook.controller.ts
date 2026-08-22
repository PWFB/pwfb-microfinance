import { Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { VirtualAccountsService } from './virtual-accounts.service';

@Controller('webhooks/paystack')
export class PaystackWebhookController {
  constructor(private readonly virtualAccounts: VirtualAccountsService) {}

  @Post()
  @HttpCode(200)
  async receive(@Headers('x-paystack-signature') signature: string | undefined, @Req() req: any) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret || !signature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const rawBody: Buffer = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const provided = signature.trim().toLowerCase();

    if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const payload = req.body ?? {};
    if (payload.event === 'charge.success') {
      await this.virtualAccounts.processPaystackCharge(payload.data ?? {});
    }

    return { received: true };
  }
}
