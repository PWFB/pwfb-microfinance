import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BranchController {
  constructor(
    private readonly branchService: BranchService,
  ) {}

  @Post()
  @Roles('ADMIN')
  create(
    @Body() createBranchDto: CreateBranchDto,
  ) {
    return this.branchService.create(createBranchDto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN')
  findAll() {
    return this.branchService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  findOne(
    @Param('id') id: string,
  ) {
    return this.branchService.findOne(+id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.branchService.update(
      +id,
      updateBranchDto,
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.branchService.remove(+id);
  }
}
