import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BankingModule } from '../banking/banking.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { LoanDisbursementService } from './loan-disbursement.service';

@Module({
  imports: [PrismaModule, BankingModule, PermissionsModule],
  controllers: [LoansController],
  providers: [LoansService, LoanDisbursementService],
  exports: [LoansService, LoanDisbursementService],
})
export class LoansModule {}
