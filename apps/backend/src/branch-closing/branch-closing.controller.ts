import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BranchClosingService } from './branch-closing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('branch-closing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER')
export class BranchClosingController {
  constructor(private readonly closing: BranchClosingService) {}

  @Get()
  list(@Req() req:any,@Query('periodId') periodId?:string){ return this.closing.list(req.user,periodId); }

  @Get(':branchId/checklist')
  checklist(@Param('branchId') branchId:string,@Query('periodId') periodId:string,@Query('closingDate') closingDate:string,@Req() req:any){ return this.closing.checklist(req.user,branchId,periodId,closingDate); }

  @Post(':branchId/submit')
  submit(@Param('branchId') branchId:string,@Body() body:{periodId:string;closingDate:string},@Req() req:any){ return this.closing.submit(req.user,branchId,body.periodId,body.closingDate); }

  @Post(':id/approve')
  approve(@Param('id') id:string,@Req() req:any){ return this.closing.approve(req.user,id); }
}
