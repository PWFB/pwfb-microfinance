import { Module } from '@nestjs/common';
import { WorkLogController } from './work-log.controller';
import { WorkLogService } from './work-log.service';

@Module({
  controllers: [WorkLogController],
  providers: [WorkLogService],
  exports: [WorkLogService],
})
export class WorkLogModule {}
