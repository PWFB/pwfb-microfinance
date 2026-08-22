import { Module } from '@nestjs/common';
import { VirtualAccountsService } from './virtual-accounts.service';

@Module({
  providers: [VirtualAccountsService],
  exports: [VirtualAccountsService],
})
export class VirtualAccountsModule {}
