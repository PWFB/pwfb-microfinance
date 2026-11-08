import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BalmzAiService } from './balmz-ai.service';
import { BalmzReceiptService } from './balmz-receipt.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const MAX_AI_MESSAGE_LENGTH = 2000;
const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;

@Controller('balmz-ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class BalmzAiController {
  constructor(private readonly balmzAi: BalmzAiService, private readonly receipts: BalmzReceiptService) {}

  @Get('diagnose')
  diagnose() { return this.balmzAi.diagnose(); }

  @Get('repair-check')
  repairCheck() { return this.balmzAi.repairCheck(); }

  @Post('chat')
  chat(@Body() body: { message?: string }) {
    const message = String(body?.message || '').trim();
    if (!message) throw new BadRequestException('BALMZ AI message is required.');
    if (message.length > MAX_AI_MESSAGE_LENGTH) {
      throw new BadRequestException(`BALMZ AI message must be ${MAX_AI_MESSAGE_LENGTH} characters or fewer.`);
    }
    return this.balmzAi.chat(message);
  }

  @Post('receipts/verify')
  @UseInterceptors(FileInterceptor('receipt', {
    limits: { fileSize: MAX_RECEIPT_BYTES },
    fileFilter: (_req, file, callback) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      callback(null, allowed.includes(file.mimetype));
    },
  }))
  verifyReceipt(@UploadedFile() file: { buffer: Buffer; mimetype: string; originalname: string }) {
    if (!file) throw new BadRequestException('Upload a JPG, PNG, WEBP or GIF payment receipt image.');
    return this.receipts.verifyReceipt(file);
  }
}
