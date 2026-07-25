import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    PrismaModule,
    StaffModule,
  ],
})
export class AppModule {}
