import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BankingController],
  providers: [BankingService, CustomerVirtualAccountService],
  exports: [BankingService, CustomerVirtualAccountService],
})
export class BankingModule {}
