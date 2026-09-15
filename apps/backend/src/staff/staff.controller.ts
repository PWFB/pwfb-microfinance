import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get('bvn/banks')
  @Roles('SUPER_ADMIN', 'ADMIN')
  bvnBanks() { return this.staffService.paystackBanks(); }

  @Post('bvn/verify')
  @Roles('SUPER_ADMIN', 'ADMIN')
  initiateBvn(@Body() body: { bvn: string; firstName: string; lastName: string; middleName?: string; bankCode: string; accountNumber: string }) {
    return this.staffService.initiateBvnVerification(body);
  }

  @Get('bvn/verify/:reference')
  @Roles('SUPER_ADMIN', 'ADMIN')
  bvnStatus(@Param('reference') reference: string) { return this.staffService.getBvnVerification(reference); }

  @Get('bvn/config-status')
  @Roles('SUPER_ADMIN')
  bvnConfigStatus() { return this.staffService.bvnConfigurationStatus(); }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() createStaffDto: CreateStaffDto) { return this.staffService.create(createStaffDto); }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll(@Query() filter: StaffFilterDto) { return this.staffService.findAll(filter); }

  @Get(':id/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  assignmentHistory(@Param('id') id: string) { return this.staffService.assignmentHistory(id); }

  @Post(':id/assignments')
  @Roles('SUPER_ADMIN', 'ADMIN')
  assign(@Param('id') id: string, @Body() body: { role: Role; regionId?: string; divisionId?: string; areaId?: string; branchId?: string; notes?: string }) { return this.staffService.assign(id, body); }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  findOne(@Param('id') id: string) { return this.staffService.findOne(id); }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() updateStaffDto: UpdateStaffDto) { return this.staffService.update(id, updateStaffDto); }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) { return this.staffService.remove(id); }
}