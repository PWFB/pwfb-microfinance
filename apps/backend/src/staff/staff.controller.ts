import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(
    @Body() createStaffDto: CreateStaffDto,
  ) {
    return this.staffService.create(createStaffDto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll(
    @Query() filter: StaffFilterDto,
  ) {
    return this.staffService.findAll(filter);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  findOne(
    @Param('id') id: string,
  ) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateStaffDto: UpdateStaffDto,
  ) {
    return this.staffService.update(
      id,
      updateStaffDto,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.staffService.remove(id);
  }
}
