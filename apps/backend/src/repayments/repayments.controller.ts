import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

@Controller('repayments')
export class RepaymentsController {
  constructor(private readonly repaymentsService: RepaymentsService) {}

  @Post()
  create(@Body() createRepaymentDto: CreateRepaymentDto) {
    return this.repaymentsService.create(createRepaymentDto);
  }

  @Get()
  findAll() {
    return this.repaymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.repaymentsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateRepaymentDto: UpdateRepaymentDto,
  ) {
    return this.repaymentsService.update(id, updateRepaymentDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.repaymentsService.remove(id);
  }
}
