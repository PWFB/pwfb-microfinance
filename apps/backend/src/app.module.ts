import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { PrismaModule } from './prisma/prisma.module';
import { StaffModule } from './staff/staff.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { CustomersModule } from './customers/customers.module';
import { LoansModule } from './loans/loans.module';
import { RepaymentsModule } from './repayments/repayments.module';
import { SavingsModule } from './savings/savings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { AdministrationModule } from './administration/administration.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { FinanceModule } from './finance/finance.module';
import { RiskComplianceModule } from './risk-compliance/risk-compliance.module';
import { HumanResourcesModule } from './human-resources/human-resources.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { PeriodsModule } from './periods/periods.module';
import { PayrollModule } from './payroll/payroll.module';
import { CashbookModule } from './cashbook/cashbook.module';
import { CollectionsModule } from './collections/collections.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { BankingModule } from './banking/banking.module';

@Module({
  imports: [
    BankingModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    AdministrationModule,
    MonitoringModule,
    FinanceModule,
    RiskComplianceModule,
    HumanResourcesModule,
    SuperAdminModule,
    StaffModule,
    BranchModule,
    CustomersModule,
    SavingsModule,
    LoansModule,
    RepaymentsModule,
    TransactionsModule,
    ReportsModule,
    PeriodsModule,
    PayrollModule,
    CashbookModule,
    CollectionsModule,
    DashboardsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
