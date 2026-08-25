import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { BalmzAiService } from './balmz-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('balmz-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BalmzAiController {
  constructor(private readonly balmzAi: BalmzAiService) {}

  @Get('diagnose')
  diagnose() { return this.balmzAi.diagnose(); }

  @Get('repair-check')
  repairCheck() { return this.balmzAi.repairCheck(); }

  @Post('chat')
  chat(@Body() body: { message?: string }) {
    return this.balmzAi.chat(String(body?.message || '').trim());
  }
}
