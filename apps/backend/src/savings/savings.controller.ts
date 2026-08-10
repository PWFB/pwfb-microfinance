import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
  ) {}

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
  )
  create(
    @Body() createSavingsDto: CreateSavingsDto,
  ) {
    return this.savingsService.create(
      createSavingsDto,
    );
  }

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'AUDITOR',
  )
  findAll() {
    return this.savingsService.findAll();
  }

  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'AUDITOR',
  )
  findOne(
    @Param('id') id: string,
  ) {
    return this.savingsService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
  )
  update(
    @Param('id') id: string,
    @Body() updateSavingsDto: UpdateSavingsDto,
  ) {
    return this.savingsService.update(
      id,
      updateSavingsDto,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.savingsService.remove(id);
  }
}
