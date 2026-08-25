import { Module } from '@nestjs/common';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffRepository } from './staff.repository';
import { BankingModule } from '../banking/banking.module';

@Module({
  imports: [BankingModule],
  controllers: [StaffController],
  providers: [StaffService, StaffRepository],
  exports: [StaffService, StaffRepository],
})
export class StaffModule {}
