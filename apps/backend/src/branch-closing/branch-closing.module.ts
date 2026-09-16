import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessScopeModule } from '../access/access-scope.module';
import { AuditModule } from '../audit/audit.module';
import { BranchClosingController } from './branch-closing.controller';
import { BranchClosingService } from './branch-closing.service';
import { BranchClosingLockInterceptor } from './branch-closing-lock.interceptor';

@Module({
  imports: [PrismaModule, AccessScopeModule, AuditModule],
  controllers: [BranchClosingController],
  providers: [
    BranchClosingService,
    BranchClosingLockInterceptor,
    { provide: APP_INTERCEPTOR, useClass: BranchClosingLockInterceptor },
  ],
  exports: [BranchClosingService, BranchClosingLockInterceptor],
})
export class BranchClosingModule {}
