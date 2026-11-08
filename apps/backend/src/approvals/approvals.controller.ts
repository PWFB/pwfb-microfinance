import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER')
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  pending(@Req() req: any) { return this.approvals.pending(req.user); }

  @Get(':loanId')
  get(@Param('loanId') loanId: string, @Req() req: any) { return this.approvals.get(loanId, req.user); }

  @Get(':loanId/history')
  history(@Param('loanId') loanId: string, @Req() req: any) { return this.approvals.history(loanId, req.user); }

  @Post(':loanId/approve')
  approve(@Param('loanId') loanId: string, @Req() req: any) { return this.approvals.approve(loanId, req.user); }

  @Post(':loanId/reject')
  reject(@Param('loanId') loanId: string, @Req() req: any, @Body() body: { reason?: string }) { return this.approvals.reject(loanId, req.user, body?.reason); }
}
