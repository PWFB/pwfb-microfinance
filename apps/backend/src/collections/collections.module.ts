import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { StaffWalletModule } from '../staff-wallet/staff-wallet.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [StaffWalletModule, PermissionsModule],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
