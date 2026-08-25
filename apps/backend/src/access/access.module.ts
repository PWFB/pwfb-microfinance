import { Global, Module } from '@nestjs/common';
import { StaffScopeService } from './staff-scope.service';
import { AccessController } from './access.controller';

@Global()
@Module({
  controllers: [AccessController],
  providers: [StaffScopeService],
  exports: [StaffScopeService],
})
export class AccessModule {}
