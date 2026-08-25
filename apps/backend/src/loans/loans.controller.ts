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
import { LoanDisbursementService } from './loan-disbursement.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanDisbursementService: LoanDisbursementService,
  ) {}

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN')
  create(@Body() createLoanDto: CreateLoanDto) {
    return this.loansService.create(createLoanDto);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER')
  findAll() {
    return this.loansService.findAll();
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER')
  findOne(@Param('id') id: string) {
    return this.loansService.findOne(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  update(@Param('id') id: string, @Body() updateLoanDto: UpdateLoanDto) {
    return this.loansService.update(id, updateLoanDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id') id: string) {
    return this.loansService.remove(id);
  }

  @Post(':id/submit-disbursement')
  @Roles('CREDIT_OFFICER')
  submitDisbursement(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: { accountNumber?: string; accountName?: string; bankCode?: string; bankName?: string; amount?: number },
  ) {
    return this.loanDisbursementService.submitForBranchReview(id, req.user, body);
  }

  @Post(':id/approve-disbursement')
  @Roles('BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN')
  approveDisbursement(@Param('id') id: string, @Req() req: any) {
    return this.loanDisbursementService.approveAndDisburse(id, req.user);
  }

  @Post(':id/reject-disbursement')
  @Roles('BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN')
  rejectDisbursement(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    return this.loanDisbursementService.reject(id, req.user, body?.reason);
  }

  @Get(':id/guarantors')
  @Roles('SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'DIVISIONAL_MANAGER', 'MONITORING_TEAM', 'AUDITOR', 'AREA_MANAGER', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER')
  findGuarantors(@Param('id') id: string) {
    return this.loansService.findGuarantors(id);
  }

  @Post(':id/guarantors')
  @Roles('SUPER_ADMIN', 'ADMIN')
  addGuarantor(@Param('id') id: string, @Body() dto: CreateGuarantorDto) {
    return this.loansService.addGuarantor(id, dto);
  }

  @Patch(':id/guarantors/:guarantorId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  updateGuarantor(@Param('id') id: string, @Param('guarantorId') guarantorId: string, @Body() dto: Partial<CreateGuarantorDto>) {
    return this.loansService.updateGuarantor(id, guarantorId, dto);
  }

  @Delete(':id/guarantors/:guarantorId')
  @Roles('SUPER_ADMIN', 'ADMIN')
  removeGuarantor(@Param('id') id: string, @Param('guarantorId') guarantorId: string) {
    return this.loansService.removeGuarantor(id, guarantorId);
  }
}
