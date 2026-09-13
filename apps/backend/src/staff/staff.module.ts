import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffRepository } from './staff.repository';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { StaffBvnWebhookController } from './staff-bvn-webhook.controller';
import { BankingModule } from '../banking/banking.module';

@Module({
  imports: [BankingModule],
  controllers: [StaffController, OrganizationController, StaffBvnWebhookController],
  providers: [StaffService, StaffRepository, OrganizationService],
  exports: [StaffService, StaffRepository, OrganizationService],
})
export class StaffModule {}
