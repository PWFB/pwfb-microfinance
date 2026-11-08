import { Module } from '@nestjs/common';
import { StaffWalletController } from './staff-wallet.controller';
import { StaffWalletService } from './staff-wallet.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [StaffWalletController],
  providers: [StaffWalletService],
  exports: [StaffWalletService],
})
export class StaffWalletModule {}
