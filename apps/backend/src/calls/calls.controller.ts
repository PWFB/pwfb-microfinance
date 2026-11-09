import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CallsService } from './calls.service';

const CALL_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER',
  'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER',
  'LOAN_OFFICER', 'AUDITOR', 'MONITORING_TEAM', 'STAFF', 'CUSTOMER',
];

@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...CALL_ROLES)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('context')
  context(@Req() req: any) { return this.calls.getContext(req.user); }

  @Get('contacts')
  contacts(@Req() req: any, @Query('branchId') branchId: string, @Query('search') search?: string) {
    return this.calls.getContacts(req.user, branchId, search);
  }

  @Get()
  list(@Req() req: any) { return this.calls.listCalls(req.user); }

  @Patch('permission')
  setPermission(@Req() req: any, @Body() body: { enabled: boolean }) {
    return this.calls.setClientCallPermission(req.user, body?.enabled);
  }

  @Post('staff')
  startStaffCall(@Req() req: any, @Body() body: { staffId: string }) {
    return this.calls.startStaffCall(req.user, body?.staffId);
  }

  @Post('client')
  startClientCall(@Req() req: any, @Body() body: { customerId: string }) {
    return this.calls.startClientCall(req.user, body?.customerId);
  }

  @Post(':callId/accept')
  accept(@Req() req: any, @Param('callId') callId: string) {
    return this.calls.acceptCall(req.user, callId);
  }

  @Post(':callId/decline')
  decline(@Req() req: any, @Param('callId') callId: string) {
    return this.calls.declineCall(req.user, callId);
  }

  @Post(':callId/end')
  end(@Req() req: any, @Param('callId') callId: string) {
    return this.calls.endCall(req.user, callId);
  }

  @Get(':callId/signals')
  signals(@Req() req: any, @Param('callId') callId: string, @Query('after') after?: string) {
    return this.calls.getSignals(req.user, callId, after);
  }

  @Post(':callId/signals')
  sendSignal(@Req() req: any, @Param('callId') callId: string, @Body() body: { kind: string; payload: unknown }) {
    return this.calls.sendSignal(req.user, callId, body?.kind, body?.payload);
  }
}
