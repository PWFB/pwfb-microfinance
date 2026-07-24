import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    PrismaModule,
  ],
  controllers: [
    TransactionsController,
  ],
  providers: [
    TransactionsService,
  ],
  exports: [
    TransactionsService,
  ],
})
export class TransactionsModule {}
