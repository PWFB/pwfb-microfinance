import { Module } from '@nestjs/common';
import { AccessScopeService } from './access-scope.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AccessScopeService],
  exports: [AccessScopeService],
})
export class AccessScopeModule {}
