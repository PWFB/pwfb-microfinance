import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PeriodsService } from './periods.service';

@Controller('periods')
export class PeriodsController {
  constructor(
    private readonly periodsService: PeriodsService,
  ) {}

  @Post()
  create(
    @Body()
    body: {
      name: string;
      startDate: string;
      endDate: string;
    },
  ) {
    return this.periodsService.create(body);
  }

  @Get()
  findAll() {
    return this.periodsService.findAll();
  }

  @Get('current')
  current() {
    return this.periodsService.current();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.periodsService.findOne(id);
  }

  @Patch(':id/close')
  close(@Param('id') id: string) {
    return this.periodsService.close(id);
  }
}
