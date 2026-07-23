import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';

import { SavingsService } from './savings.service';
import { CreateSavingsDto } from './dto/create-savings.dto';
import { UpdateSavingsDto } from './dto/update-savings.dto';

@Controller('savings')
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
  ) {}

  @Post()
  create(
    @Body() createSavingsDto: CreateSavingsDto,
  ) {
    return this.savingsService.create(
      createSavingsDto,
    );
  }

  @Get()
  findAll() {
    return this.savingsService.findAll();
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
  ) {
    return this.savingsService.findOne(id);
  }

  @Patch(':id')
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
  remove(
    @Param('id') id: string,
  ) {
    return this.savingsService.remove(id);
  }
}
