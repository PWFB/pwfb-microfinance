import { Module } from '@nestjs/common';
import { StaffWalletController } from './staff-wallet.controller';
import { StaffWalletService } from './staff-wallet.service';

@Module({
  controllers: [StaffWalletController],
  providers: [StaffWalletService],
  exports: [StaffWalletService],
})
export class StaffWalletModule {}
