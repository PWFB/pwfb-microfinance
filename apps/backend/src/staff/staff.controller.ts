import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AccessScopeService } from '../access/access-scope.service';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService, private readonly accessScope: AccessScopeService) {}

  @Get('bvn/banks')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  bvnBanks() { return this.staffService.paystackBanks(); }

  @Post('bvn/verify')
  @Roles('SUPER_ADMIN', 'ADMIN')
  initiateBvn(@Body() body: { bvn: string; firstName: string; lastName: string; middleName?: string; phone: string; bankCode: string; accountNumber: string }) {
    return this.staffService.initiateBvnVerification(body);
  }

  @Get('bvn/verify/:reference')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  bvnStatus(@Param('reference') reference: string) { return this.staffService.getBvnVerification(reference); }

  @Get('bvn/config-status')
  @Roles('SUPER_ADMIN')
  bvnConfigStatus() { return this.staffService.bvnConfigurationStatus(); }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() createStaffDto: CreateStaffDto) { return this.staffService.create(createStaffDto); }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  findAll(@Query() filter: StaffFilterDto) { return this.staffService.findAll(filter); }

  @Get(':id/virtual-account')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  virtualAccount(@Param('id') id: string) { return this.staffService.virtualAccount(id); }

  @Get(':id/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  assignmentHistory(@Param('id') id: string) { return this.staffService.assignmentHistory(id); }

  @Post(':id/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  async assign(@Param('id') id: string, @Body() body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }, @Req() req: any) {
    await this.accessScope.assertStaff(req.user, id);
    if (body.branchId) await this.accessScope.assertBranch(req.user, body.branchId);
    else if (body.areaId) await this.accessScope.assertArea(req.user, body.areaId);
    else if (body.divisionId) await this.accessScope.assertDivision(req.user, body.divisionId);
    else if (body.regionId) await this.accessScope.assertRegion(req.user, body.regionId);
    else if (['AUDITOR', 'MONITORING_TEAM'].includes(String(body.role)) && req.user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only Super Admin can create an organization-wide oversight assignment');
    }
    return this.staffService.assign(id, body);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'AREA_MANAGER', 'BRANCH_MANAGER', 'AUDITOR', 'MONITORING_TEAM', 'CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF')
  findOne(@Param('id') id: string) { return this.staffService.findOne(id); }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) { return this.staffService.update(id, updateStaffDto); }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) { return this.staffService.remove(id); }
}