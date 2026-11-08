import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AccessScopeService } from './access-scope.service';
import { AccessScopeInterceptor } from './access-scope.interceptor';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AccessScopeService, { provide: APP_INTERCEPTOR, useClass: AccessScopeInterceptor }],
  exports: [AccessScopeService],
})
export class AccessScopeModule {}
