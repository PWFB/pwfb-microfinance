import { Body, Controller, Headers, Post } from '@nestjs/common';
import { StaffService } from './staff.service';

/** Public Paystack webhook boundary. Signature is verified server-side with PAYSTACK_SECRET_KEY. */
@Controller('webhooks/staff/bvn')
export class StaffBvnWebhookController {
  constructor(private readonly staffService: StaffService) {}

  @Post('paystack')
  paystack(@Headers('x-paystack-signature') signature: string, @Body() body: any) {
    return this.staffService.handleBvnWebhook(body, signature);
  }
}