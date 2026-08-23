import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';
import { CustomerVirtualAccountWebhookController } from './customer-virtual-account-webhook.controller';
import { WalletWithdrawalWebhookService } from './wallet-withdrawal-webhook.service';
import { WalletWithdrawalWebhookController } from './wallet-withdrawal-webhook.controller';
import { NibssService } from './nibss.service';
import { FlutterwaveService } from './flutterwave.service';
import { ExternalBankTransferService } from './external-bank-transfer.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    BankingController,
    CustomerVirtualAccountWebhookController,
    WalletWithdrawalWebhookController,
  ],
  providers: [
    BankingService,
    CustomerVirtualAccountService,
    CustomerVirtualAccountWebhookService,
    WalletWithdrawalWebhookService,
    NibssService,
    FlutterwaveService,
    ExternalBankTransferService,
  ],
  exports: [
    BankingService,
    CustomerVirtualAccountService,
    CustomerVirtualAccountWebhookService,
    WalletWithdrawalWebhookService,
    NibssService,
    FlutterwaveService,
    ExternalBankTransferService,
  ],
})
export class BankingModule {}
