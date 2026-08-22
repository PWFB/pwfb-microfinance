import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { CustomerVirtualAccountWebhookService } from './customer-virtual-account-webhook.service';
import { CustomerVirtualAccountWebhookController } from './customer-virtual-account-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    BankingController,
    CustomerVirtualAccountWebhookController,
  ],
  providers: [
    BankingService,
    CustomerVirtualAccountService,
    CustomerVirtualAccountWebhookService,
  ],
  exports: [
    BankingService,
    CustomerVirtualAccountService,
    CustomerVirtualAccountWebhookService,
  ],
})
export class BankingModule {}
