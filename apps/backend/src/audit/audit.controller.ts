import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'AUDITOR')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('action') action?: string, @Query('role') role?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.audit.list({ page: Number(page) || 1, limit: Number(limit) || 25, search, action, role, from, to });
  }
}
