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

import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
  ) {}

  @Post()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
  )
  create(
    @Body() createLoanDto: CreateLoanDto,
  ) {
    return this.loansService.create(
      createLoanDto,
    );
  }

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'AUDITOR',
  )
  findAll() {
    return this.loansService.findAll();
  }

  @Get(':id')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'LOAN_OFFICER',
    'AUDITOR',
  )
  findOne(
    @Param('id') id: string,
  ) {
    return this.loansService.findOne(id);
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
    @Body() updateLoanDto: UpdateLoanDto,
  ) {
    return this.loansService.update(
      id,
      updateLoanDto,
    );
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(
    @Param('id') id: string,
  ) {
    return this.loansService.remove(id);
  }
}
