import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MessagesService } from './messages.service';

const STAFF_ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER',
  'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'TELLER',
  'LOAN_OFFICER', 'AUDITOR', 'MONITORING_TEAM', 'STAFF',
];

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('context')
  context(@Req() req: any) { return this.messages.getContext(req.user); }

  @Get('staff')
  staff(@Req() req: any, @Query('branchId') branchId: string) {
    return this.messages.getBranchStaff(req.user, branchId);
  }

  @Get('roles')
  roles(@Req() req: any, @Query('branchId') branchId: string) {
    return this.messages.getBranchRoleTargets(req.user, branchId);
  }

  @Get()
  list(@Req() req: any) { return this.messages.listConversations(req.user); }

  @Post('role')
  sendToRole(@Req() req: any, @Body() body: { branchId: string; roleTarget: string; message: string }) {
    return this.messages.sendToRole(req.user, body);
  }

  @Post('groups')
  createGroup(@Req() req: any, @Body() body: { branchId: string; title: string; staffIds: string[]; message?: string }) {
    return this.messages.createGroup(req.user, body);
  }

  @Get(':conversationId')
  conversation(@Req() req: any, @Param('conversationId') conversationId: string) {
    return this.messages.getConversation(req.user, conversationId);
  }

  @Post(':conversationId/read')
  markRead(@Req() req: any, @Param('conversationId') conversationId: string) {
    return this.messages.markRead(req.user, conversationId);
  }

  @Post(':conversationId/messages')
  sendMessage(@Req() req: any, @Param('conversationId') conversationId: string, @Body() body: { message: string }) {
    return this.messages.sendMessage(req.user, conversationId, body?.message);
  }
}
