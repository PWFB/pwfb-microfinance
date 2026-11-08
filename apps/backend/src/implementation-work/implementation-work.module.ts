import { Module } from '@nestjs/common';
import { ImplementationWorkController } from './implementation-work.controller';
import { ImplementationWorkService } from './implementation-work.service';

@Module({
  controllers: [ImplementationWorkController],
  providers: [ImplementationWorkService],
})
export class ImplementationWorkModule {}
