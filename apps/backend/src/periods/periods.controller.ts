import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TwoFactorService } from '../auth/two-factor.service';

const PERIOD_READ_ROLES = [
  'SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER',
  'BRANCH_MANAGER','TELLER','CREDIT_OFFICER','LOAN_OFFICER','STAFF','AUDITOR','MONITORING_TEAM',
];

@Controller('periods')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeriodsController {
  constructor(
    private readonly periodsService: PeriodsService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  private async requireMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  async create(@Body() body: { name: string; startDate: string; endDate: string }, @Req() req: any) {
    await this.requireMfa(req);
    return this.periodsService.create(body);
  }

  @Get()
  @Roles(...PERIOD_READ_ROLES)
  findAll() {
    return this.periodsService.findAll();
  }

  @Get('current')
  @Roles(...PERIOD_READ_ROLES)
  current() {
    return this.periodsService.current();
  }

  @Get(':id/closing-check')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM')
  closingCheck(@Param('id') id: string, @Req() req: any) {
    return this.periodsService.closingCheck(id, req.user);
  }

  @Get(':id')
  @Roles(...PERIOD_READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Patch(':id/close')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async close(@Param('id') id: string, @Req() req: any) {
    await this.requireMfa(req);
    return this.periodsService.close(id, req.user);
  }
}
