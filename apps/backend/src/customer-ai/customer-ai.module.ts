import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAiController } from './customer-ai.controller';
import { CustomerAiService } from './customer-ai.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerAiController],
  providers: [CustomerAiService],
})
export class CustomerAiModule {}
