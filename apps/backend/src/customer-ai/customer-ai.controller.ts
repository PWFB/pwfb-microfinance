import {
  BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile,
  UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerAiService } from './customer-ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;
const RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

@Controller('customer-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class CustomerAiController {
  constructor(private readonly ai: CustomerAiService) {}

  @Get('context')
  context(@Req() req: any) { return this.ai.context(req.user); }

  @Get('conversations')
  conversations(@Req() req: any) { return this.ai.listConversations(req.user); }

  @Get('conversations/:id')
  conversation(@Param('id') id: string, @Req() req: any) { return this.ai.getConversation(req.user, id); }

  @Get('cases')
  cases(@Req() req: any) { return this.ai.listCases(req.user); }

  @Get('cases/:id/attachment')
  attachment(@Param('id') id: string, @Req() req: any) { return this.ai.getCaseAttachment(req.user, id); }

  @Post('chat')
  @UseInterceptors(FileInterceptor('attachment', {
    limits: { fileSize: MAX_RECEIPT_BYTES },
    fileFilter: (_req, file, callback) => {
      if (RECEIPT_TYPES.has(file.mimetype)) callback(null, true);
      else callback(new BadRequestException('Upload a JPG, PNG, WEBP image or PDF receipt.'), false);
    },
  }))
  chat(@Body() body: any, @UploadedFile() file: any, @Req() req: any) {
    return this.ai.chat(req.user, body, file);
  }
}
