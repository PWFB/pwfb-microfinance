import { Module } from '@nestjs/common';
import { CustomerAiController } from './customer-ai.controller';
import { CustomerAiService } from './customer-ai.service';

@Module({
  controllers: [CustomerAiController],
  providers: [CustomerAiService],
})
export class CustomerAiModule {}
