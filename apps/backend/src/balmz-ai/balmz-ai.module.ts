import { Module } from '@nestjs/common';
import { BalmzAiController } from './balmz-ai.controller';
import { BalmzAiService } from './balmz-ai.service';
import { BalmzReceiptService } from './balmz-receipt.service';

@Module({
  controllers: [BalmzAiController],
  providers: [BalmzAiService, BalmzReceiptService],
})
export class BalmzAiModule {}
