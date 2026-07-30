import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { PrismaModule } from './prisma/prisma.module';
import { StaffModule } from './staff/staff.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    PrismaModule,
    StaffModule,
    ReportsModule,
    AuthModule,
    BranchModule,
    CustomerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
