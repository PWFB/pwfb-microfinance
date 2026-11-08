import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Query, UseGuards } from '@nestjs/common';
import { LoansService } from './loans.service';
import { LoanDisbursementService } from './loan-disbursement.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ExternalBankTransferService } from '../banking/external-bank-transfer.service';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService, private readonly loanDisbursementService: LoanDisbursementService, private readonly externalBankTransferService: ExternalBankTransferService, private readonly permissions: PermissionsService) {}
  @Get('rates') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') getRates(){return this.loansService.getLoanRates();}
  @Patch('rates/:loanType') @Roles('SUPER_ADMIN','ADMIN') setRate(@Param('loanType') loanType:string,@Body() body:{interestRate:number}){return this.loansService.setLoanRate(decodeURIComponent(loanType),Number(body.interestRate));}
  @Get('verify-bank-account') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') async verifyBankAccount(@Query('customerId') customerId:string,@Query('bankCode') bankCode:string,@Query('accountNumber') accountNumber:string){
    if(customerId?.trim()) return this.externalBankTransferService.verifyCustomerBankAccount(customerId,bankCode,accountNumber);
    const result=await this.externalBankTransferService.nameEnquiry(bankCode,accountNumber);
    return {...result,customerKnown:false,eligible:true,verification:'VERIFIED',beneficiaryType:'EXTERNAL_BANK_ACCOUNT'};
  }
  @Post() @Roles('CREDIT_OFFICER','SUPER_ADMIN','ADMIN') async create(@Body() dto:CreateLoanDto,@Req() req:any){await this.permissions.assert(req.user.role,'LOAN_CREATE');return this.loansService.create(dto);}
  @Get() @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') findAll(){return this.loansService.findAll();}
  @Get(':id/schedule') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') getSchedule(@Param('id') id:string){return this.loansService.getRepaymentSchedule(id);}
  @Get(':id') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') findOne(@Param('id') id:string){return this.loansService.findOne(id);}
  @Patch(':id') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER') update(@Param('id') id:string,@Body() dto:UpdateLoanDto){return this.loansService.update(id,dto);}
  @Delete(':id') @Roles('SUPER_ADMIN','ADMIN') remove(@Param('id') id:string){return this.loansService.remove(id);}
  @Post(':id/submit-disbursement') @Roles('CREDIT_OFFICER') submitDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:any){return this.loanDisbursementService.submitForBranchReview(id,req.user,body);}
  @Post(':id/approve-disbursement') @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN') async approveDisbursement(@Param('id') id:string,@Req() req:any){await this.permissions.assert(req.user.role,'LOAN_DISBURSE');return this.loanDisbursementService.approveAndDisburse(id,req.user);}
  @Post(':id/reject-disbursement') @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN') rejectDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:{reason?:string}){return this.loanDisbursementService.reject(id,req.user,body?.reason);}
  @Get(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') findGuarantors(@Param('id') id:string){return this.loansService.findGuarantors(id);}
  @Post(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','CREDIT_OFFICER') addGuarantor(@Param('id') id:string,@Body() dto:CreateGuarantorDto){return this.loansService.addGuarantor(id,dto);}
  @Patch(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN','CREDIT_OFFICER','BRANCH_MANAGER') updateGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string,@Body() dto:Partial<CreateGuarantorDto>){return this.loansService.updateGuarantor(id,guarantorId,dto);}
  @Delete(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN') removeGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string){return this.loansService.removeGuarantor(id,guarantorId);}
}
