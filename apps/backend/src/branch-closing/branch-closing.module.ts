import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessScopeModule } from '../access/access-scope.module';
import { AuditModule } from '../audit/audit.module';
import { BranchClosingController } from './branch-closing.controller';
import { BranchClosingService } from './branch-closing.service';

@Module({
  imports: [PrismaModule, AccessScopeModule, AuditModule],
  controllers: [BranchClosingController],
  providers: [BranchClosingService],
  exports: [BranchClosingService],
})
export class BranchClosingModule {}
