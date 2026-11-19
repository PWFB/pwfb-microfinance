import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CustomerAiService } from './customer-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('customer-ai')
@UseGuards(JwtAuthGuard)
export class CustomerAiController {
  constructor(private readonly ai: CustomerAiService) {}

  @Get('cases')
  listCases(@Req() req: any) {
    return this.ai.listCases(req.user);
  }

  @Get('cases/:id')
  getCase(@Param('id') id: string, @Req() req: any) {
    return this.ai.getCase(id, req.user);
  }

  @Post('chat')
  chat(@Body() body: { message?: string; caseId?: string; category?: string; attachments?: unknown }, @Req() req: any) {
    const message = String(body?.message || '').trim();
    return this.ai.chat(message, req.user, body?.caseId, body?.attachments, body?.category);
  }
}
