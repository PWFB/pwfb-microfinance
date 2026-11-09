import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkProgressService } from './work-progress.service';

@Controller('work-progress')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class WorkProgressController {
  constructor(private readonly workProgress: WorkProgressService) {}

  @Get()
  list() { return this.workProgress.list(); }

  @Post()
  create(@Body() body: { title?: string; description?: string; nextStep?: string }, @Req() req: any) {
    return this.workProgress.create(body, req.user?.id || req.user?.sub);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { status?: string; nextStep?: string; evidence?: string; description?: string }, @Req() req: any) {
    return this.workProgress.update(id, body, req.user?.id || req.user?.sub);
  }
}
