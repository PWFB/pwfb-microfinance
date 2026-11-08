import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAiService } from './customer-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customer-ai')
@UseGuards(JwtAuthGuard)
export class CustomerAiController {
  constructor(private readonly ai: CustomerAiService) {}

  @Post('chat')
  chat(@Body() body: { message?: string }, @Req() req: any) {
    const message = String(body?.message || '').trim();
    if (!message) return { assistant: 'BALMZ AI', reply: 'Please enter a question.' };
    return this.ai.chat(message.slice(0, 2000), req.user);
  }
}
