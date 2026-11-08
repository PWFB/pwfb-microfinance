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
import { TwoFactorService } from '../auth/two-factor.service';
import { AccessScopeService } from '../access/access-scope.service';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(
    private readonly loansService: LoansService,
    private readonly loanDisbursementService: LoanDisbursementService,
    private readonly externalBankTransferService: ExternalBankTransferService,
    private readonly permissions: PermissionsService,
    private readonly twoFactorService: TwoFactorService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async requireDisbursementMfa(req: any) {
    const authorization = String(req?.headers?.authorization || '');
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    return this.twoFactorService.assertVerified(String(req?.user?.id || ''), token);
  }
  @Get('rates') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','ASSET_LOAN_MANAGER','LOAN_OFFICER') getRates(){return this.loansService.getLoanRates();}
  @Patch('rates/:loanType') @Roles('SUPER_ADMIN','ADMIN') setRate(@Param('loanType') loanType:string,@Body() body:{interestRate:number}){return this.loansService.setLoanRate(decodeURIComponent(loanType),Number(body.interestRate));}
  @Get('verify-bank-account') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') async verifyBankAccount(@Query('customerId') customerId:string,@Query('bankCode') bankCode:string,@Query('accountNumber') accountNumber:string,@Req() req:any){
    if(customerId?.trim()) { await this.accessScope.assertCustomer(req.user, customerId); return this.externalBankTransferService.verifyCustomerBankAccount(customerId,bankCode,accountNumber); }
    const result=await this.externalBankTransferService.nameEnquiry(bankCode,accountNumber);
    return {...result,customerKnown:false,eligible:true,verification:'VERIFIED',beneficiaryType:'EXTERNAL_BANK_ACCOUNT'};
  }
  @Post() @Roles('CREDIT_OFFICER','TELLER','SUPER_ADMIN','ADMIN','BRANCH_MANAGER') async create(@Body() dto:CreateLoanDto,@Req() req:any){await this.permissions.assert(req.user.role,'LOAN_CREATE');return this.loansService.create(dto,req.user);}
  @Get() @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','ASSET_LOAN_MANAGER','LOAN_OFFICER') findAll(@Req() req:any){return this.loansService.findAll(req.user);}
  @Get('registered-staff-borrowers')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','TELLER')
  listRegisteredStaffBorrowers(@Req() req:any){return this.loansService.listRegisteredStaffBorrowers(req.user);}
    @Get(':id/schedule') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','ASSET_LOAN_MANAGER','LOAN_OFFICER') getSchedule(@Param('id') id:string,@Req() req:any){return this.loansService.getRepaymentSchedule(id,req.user);}
  @Get(':id') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','ASSET_LOAN_MANAGER','LOAN_OFFICER') findOne(@Param('id') id:string,@Req() req:any){return this.loansService.findOne(id,req.user);}
  @Patch(':id') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER') async update(@Param('id') id:string,@Body() dto:UpdateLoanDto,@Req() req:any){await this.requireDisbursementMfa(req);return this.loansService.update(id,dto,req.user);}
  @Delete(':id') @Roles('SUPER_ADMIN','ADMIN') async remove(@Param('id') id:string,@Req() req:any){await this.requireDisbursementMfa(req);return this.loansService.remove(id,req.user);}
  @Post(':id/submit-disbursement') @Roles('CREDIT_OFFICER','TELLER') async submitDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:any){await this.requireDisbursementMfa(req);return this.loanDisbursementService.submitForBranchReview(id,req.user,body);}
  @Post(':id/asset-review')
  @Roles('ASSET_LOAN_MANAGER')
  async assetReview(@Param('id') id: string, @Req() req: any, @Body() body: { note?: string }) {
    await this.permissions.assert(req.user.role, 'ASSET_LOAN_REVIEW');
    await this.requireDisbursementMfa(req);
    return this.loanDisbursementService.reviewAssetLoan(id, req.user, body?.note);
  }

  @Post(':id/approve-disbursement')
  @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN')
  async approveDisbursement(@Param('id') id: string, @Req() req: any) {
    await this.permissions.assert(req.user.role, 'LOAN_DISBURSE');
    await this.requireDisbursementMfa(req);
    return this.loanDisbursementService.approveAndDisburse(id, req.user);
  }
  @Post(':id/reject-disbursement') @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN') async rejectDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:{reason?:string}){await this.requireDisbursementMfa(req);return this.loanDisbursementService.reject(id,req.user,body?.reason);}
  @Get(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','ASSET_LOAN_MANAGER','LOAN_OFFICER') findGuarantors(@Param('id') id:string,@Req() req:any){return this.loansService.findGuarantors(id,req.user);}
  @Post(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','CREDIT_OFFICER','TELLER') addGuarantor(@Param('id') id:string,@Body() dto:CreateGuarantorDto,@Req() req:any){return this.loansService.addGuarantor(id,dto,req.user);}
  @Patch(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER') async updateGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string,@Body() dto:Partial<CreateGuarantorDto>,@Req() req:any){await this.requireDisbursementMfa(req);return this.loansService.updateGuarantor(id,guarantorId,dto,req.user);}
  @Delete(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN') async removeGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string,@Req() req:any){await this.requireDisbursementMfa(req);return this.loansService.removeGuarantor(id,guarantorId,req.user);}
}
