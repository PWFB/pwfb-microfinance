import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

const STAFF_VIEW_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'REGIONAL_MANAGER',
  'DIVISIONAL_MANAGER',
  'MONITORING_TEAM',
  'AUDITOR',
  'AREA_MANAGER',
  'BRANCH_MANAGER',
  'CREDIT_OFFICER',
  'LOAN_OFFICER',
  'TELLER',
  'STAFF',
];

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post('bvn/verify')
  @Roles('SUPER_ADMIN', 'ADMIN')
  verifyBvn(@Body() body: { bvn: string }) {
    return this.staffService.verifyBvn(body.bvn);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() createStaffDto: CreateStaffDto) {
    return this.staffService.create(createStaffDto);
  }

  @Get()
  @Roles(...STAFF_VIEW_ROLES)
  findAll(@Req() req: any, @Query() filter: StaffFilterDto) {
    return this.staffService.findAll(filter, req.user);
  }

  @Get('visible')
  @Roles(...STAFF_VIEW_ROLES)
  visible(@Req() req: any, @Query() filter: StaffFilterDto) {
    return this.staffService.findVisible(filter, req.user);
  }

  @Get(':id/assignments')
  @Roles(...STAFF_VIEW_ROLES)
  assignmentHistory(@Req() req: any, @Param('id') id: string) {
    return this.staffService.assignmentHistory(id, req.user);
  }

  @Post(':id/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  assign(
    @Param('id') id: string,
    @Body() body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string },
  ) {
    return this.staffService.assign(id, body);
  }

  @Get(':id')
  @Roles(...STAFF_VIEW_ROLES)
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.staffService.findOneVisible(id, req.user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) {
    return this.staffService.update(id, updateStaffDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.staffService.remove(id);
  }
}
