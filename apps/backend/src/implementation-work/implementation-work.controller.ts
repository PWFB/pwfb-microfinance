import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ImplementationWorkService } from './implementation-work.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('implementation-work')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
export class ImplementationWorkController {
  constructor(private readonly work: ImplementationWorkService) {}

  @Get()
  list(@Query('status') status?: string, @Query('module') module?: string) {
    return this.work.list({ status, module });
  }

  @Get(':id/history')
  history(@Param('id') id: string) {
    return this.work.history(id);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.work.get(id);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.work.create(body, req.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.work.update(id, body, req.user);
  }
}
