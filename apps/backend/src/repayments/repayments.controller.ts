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

import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('repayments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RepaymentsController {
  constructor(
    private readonly repaymentsService: RepaymentsService,
  ) {}

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'TELLER',
  )
  create(
    @Body() createRepaymentDto: CreateRepaymentDto,
  ) {
    return this.repaymentsService.create(
      createRepaymentDto,
    );
  }

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
  )
  findAll() {
    return this.repaymentsService.findAll();
  }

  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
  )
  findOne(
    @Param('id') id: string,
  ) {
    return this.repaymentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
  )
  update(
    @Param('id') id: string,
    @Body() updateRepaymentDto: UpdateRepaymentDto,
  ) {
    return this.repaymentsService.update(
      id,
      updateRepaymentDto,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.repaymentsService.remove(id);
  }
}
