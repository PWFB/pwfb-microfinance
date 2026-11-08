import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BankingModule } from '../banking/banking.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [PrismaModule, BankingModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
