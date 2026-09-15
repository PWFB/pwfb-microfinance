import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { StaffService } from './staff.service';

/** Public Paystack webhook boundary. The signature is verified against the raw request body. */
@Controller('webhooks/staff/bvn')
export class StaffBvnWebhookController {
  constructor(private readonly staffService: StaffService) {}

  @Post('paystack')
  paystack(@Headers('x-paystack-signature') signature: string, @Body() body: any, @Req() req: any) {
    return this.staffService.handleBvnWebhook(body, signature, req.rawBody);
  }
}
