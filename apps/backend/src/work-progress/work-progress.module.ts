import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkProgressController } from './work-progress.controller';
import { WorkProgressService } from './work-progress.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkProgressController],
  providers: [WorkProgressService],
})
export class WorkProgressModule {}
