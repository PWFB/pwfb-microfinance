import { Global, Module } from '@nestjs/common';
import { StaffScopeService } from './staff-scope.service';

@Global()
@Module({
  providers: [StaffScopeService],
  exports: [StaffScopeService],
})
export class AccessModule {}
