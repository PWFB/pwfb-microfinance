import { Body, Controller, Headers, Post } from '@nestjs/common';
import { StaffService } from './staff.service';

/** Public Flutterwave webhook boundary. Authentication is the verif-hash header. */
@Controller('webhooks/staff/bvn')
export class StaffBvnWebhookController {
  constructor(private readonly staffService: StaffService) {}

  @Post('flutterwave')
  flutterwave(@Headers('verif-hash') signature: string, @Body() body: any) {
    return this.staffService.handleBvnWebhook(body, signature);
  }
}
