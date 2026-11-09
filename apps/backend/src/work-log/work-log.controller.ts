import { Body, Controller, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { WorkLogService } from './work-log.service';
import type { WorkItemInput } from './work-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('work-log')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN', 'AUDITOR')
export class WorkLogController {
  constructor(private readonly workLog: WorkLogService) {}

  private actor(req: any) {
    const id = String(req?.user?.id || '').trim();
    if (!id) throw new UnauthorizedException('Authenticated user identity is missing.');
    return { id };
  }

  @Get('summary')
  summary() {
    return this.workLog.summary();
  }

  @Get()
  list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('sessionKey') sessionKey?: string,
    @Query('includeCompleted') includeCompleted?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workLog.list({
      q, status, category, sessionKey,
      includeCompleted: includeCompleted === 'true',
      page: Number(page) || 1, limit: Number(limit) || 25,
    });
  }

  @Get(':reference')
  get(@Param('reference') reference: string) {
    return this.workLog.get(reference);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() body: WorkItemInput, @Req() req: any) {
    return this.workLog.create(body, this.actor(req));
  }

  @Patch(':reference')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('reference') reference: string, @Body() body: WorkItemInput, @Req() req: any) {
    return this.workLog.update(reference, body, this.actor(req));
  }
}
