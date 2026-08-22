import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { NibssService } from './nibss.service';
import { ExternalBankTransferService } from './external-bank-transfer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BankingController],
  providers: [BankingService, NibssService, ExternalBankTransferService],
  exports: [BankingService, NibssService, ExternalBankTransferService],
})
export class BankingModule {}
