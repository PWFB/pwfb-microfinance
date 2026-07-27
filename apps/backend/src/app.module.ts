import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

import { PrismaModule } from './prisma/prisma.module';
import { StaffModule } from './staff/staff.module';
import { ReportsModule } from './reports/reports.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    StaffModule,
    ReportsModule,
    AuthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
