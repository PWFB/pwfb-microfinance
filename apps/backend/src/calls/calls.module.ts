import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccessScopeModule } from '../access/access-scope.module';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';

@Module({
  imports: [PrismaModule, AccessScopeModule],
  controllers: [CallsController],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
