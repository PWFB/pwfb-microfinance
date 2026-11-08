import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AccessScopeModule } from '../access/access-scope.module';
import { AuditInterceptor } from './audit.interceptor';
import { AuditController } from './audit.controller';

@Global()
@Module({
  imports: [AccessScopeModule],
  controllers: [AuditController],
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
