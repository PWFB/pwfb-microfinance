import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER')
  create(@Body() createLoanDto: CreateLoanDto, @Req() req: any) {
    return this.loansService.create(createLoanDto, req.user);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER', 'AUDITOR')
  findAll(@Req() req: any) {
    return this.loansService.findAll(req.user);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER', 'AUDITOR')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.loansService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto, @Req() req: any) {
    return this.loansService.update(id, updateLoanDto, req.user);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.loansService.remove(id, req.user);
  }

  @Get(':id/guarantors')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER', 'AUDITOR')
  findGuarantors(@Param('id') id: string, @Req() req: any) {
    return this.loansService.findGuarantors(id, req.user);
  }

  @Post(':id/guarantors')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER')
  addGuarantor(@Param('id') id: string, @Body() dto: CreateGuarantorDto, @Req() req: any) {
    return this.loansService.addGuarantor(id, dto, req.user);
  }

  @Patch(':id/guarantors/:guarantorId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'LOAN_OFFICER')
  updateGuarantor(@Param('id') id: string, @Param('guarantorId') guarantorId: string, @Body() dto: Partial<CreateGuarantorDto>, @Req() req: any) {
    return this.loansService.updateGuarantor(id, guarantorId, dto, req.user);
  }

  @Delete(':id/guarantors/:guarantorId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  removeGuarantor(@Param('id') id: string, @Param('guarantorId') guarantorId: string, @Req() req: any) {
    return this.loansService.removeGuarantor(id, guarantorId, req.user);
  }
}
