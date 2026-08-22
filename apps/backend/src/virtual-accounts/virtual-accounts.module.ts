import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { VirtualAccountsService } from './virtual-accounts.service';
import { PaystackVirtualAccountProvider } from './paystack-virtual-account.provider';
import { VIRTUAL_ACCOUNT_PROVIDER } from './virtual-accounts.types';

@Module({
  imports: [PrismaModule],
  providers: [
    VirtualAccountsService,
    PaystackVirtualAccountProvider,
    {
      provide: VIRTUAL_ACCOUNT_PROVIDER,
      useExisting: PaystackVirtualAccountProvider,
    },
  ],
  exports: [VirtualAccountsService],
})
export class VirtualAccountsModule {}
