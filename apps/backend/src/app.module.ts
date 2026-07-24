import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { SavingsModule } from './savings/savings.module';
import { LoansModule } from './loans/loans.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    UsersModule,
    CustomersModule,
    SavingsModule,
    LoansModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
