import { Module } from '@nestjs/common';
import { BalmzAiController } from './balmz-ai.controller';
import { BalmzAiService } from './balmz-ai.service';

@Module({
  controllers: [BalmzAiController],
  providers: [BalmzAiService],
})
export class BalmzAiModule {}
