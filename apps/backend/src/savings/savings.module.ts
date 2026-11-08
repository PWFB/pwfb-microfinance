import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuthModule } from '../auth/auth.module';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';

@Module({
  imports: [PrismaModule, PermissionsModule, AuthModule],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService],
})
export class SavingsModule {}
