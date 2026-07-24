import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffFilterDto } from './dto/staff-filter.dto';

@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
  ) {}

  @Post()
  create(
    @Body() createStaffDto: CreateStaffDto,
  ) {
    return this.staffService.create(createStaffDto);
  }

  @Get()
  findAll(
    @Query() filter: StaffFilterDto,
  ) {
    return this.staffService.findAll(filter);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.staffService.findOne(id);
  }

  @Patch(':id')
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
  remove(
    @Param('id') id: string,
  ) {
    return this.staffService.remove(id);
  }
}
