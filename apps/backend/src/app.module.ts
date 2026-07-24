import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from './prisma/prisma.module';

import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { SavingsModule } from './savings/savings.module';
import { LoansModule } from './loans/loans.module';
import { TransactionsModule } from './transactions/transactions.module';
import { RepaymentsModule } from './repayments/repayments.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CustomersModule,
    SavingsModule,
    LoansModule,
    TransactionsModule,
    RepaymentsModule,
  ],
  controllers: [
    AppController,
  ],
  providers: [
    AppService,
  ],
})
export class AppModule {}
