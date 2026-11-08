import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
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
