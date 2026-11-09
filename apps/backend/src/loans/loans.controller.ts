import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Query, UseGuards } from '@nestjs/common';
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
import { AccessScopeService } from '../access/access-scope.service';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService, private readonly loanDisbursementService: LoanDisbursementService, private readonly externalBankTransferService: ExternalBankTransferService, private readonly permissions: PermissionsService, private readonly accessScope: AccessScopeService) {}
  @Get('rates') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER') getRates(){return this.loansService.getLoanRates();}
  @Patch('rates/:loanType') @Roles('SUPER_ADMIN','ADMIN') setRate(@Param('loanType') loanType:string,@Body() body:{interestRate:number}){return this.loansService.setLoanRate(decodeURIComponent(loanType),Number(body.interestRate));}
  @Get('verify-bank-account') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CREDIT_OFFICER','LOAN_OFFICER') async verifyBankAccount(@Query('customerId') customerId:string,@Query('bankCode') bankCode:string,@Query('accountNumber') accountNumber:string,@Req() req:any){
    if(customerId?.trim()){await this.accessScope.assertCustomer(req.user,customerId);return this.externalBankTransferService.verifyCustomerBankAccount(customerId,bankCode,accountNumber);}
    const result=await this.externalBankTransferService.nameEnquiry(bankCode,accountNumber);
    return {...result,customerKnown:false,eligible:true,verification:'VERIFIED',beneficiaryType:'EXTERNAL_BANK_ACCOUNT'};
  }
  @Post() @Roles('CREDIT_OFFICER','SUPER_ADMIN','ADMIN') async create(@Body() dto:CreateLoanDto,@Req() req:any){await this.permissions.assert(req.user.role,'LOAN_CREATE');await this.accessScope.assertCustomer(req.user,dto.customerId);return this.loansService.create(dto);}
  @Get('repayments/daily') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER')
  async dailyRepaymentRegister(@Query('date') date:string|undefined,@Req() req:any){
    const selectedDate=date||new Date().toISOString().slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate))throw new BadRequestException('Date must use YYYY-MM-DD');
    const loans=await this.loansService.findAll();
    const visible=await this.accessScope.filterList(req.user,'loans',loans);
    const eligibleDailyLoans=visible.filter((loan:any)=>
      String(loan.status||'').toUpperCase()==='DISBURSED'
      && String(loan.repaymentFrequency||'').toLowerCase().includes('daily'),
    );
    const schedules=await Promise.all(eligibleDailyLoans.map(async(loan:any)=>({loan,schedule:await this.loansService.getRepaymentSchedule(loan.id)})));
    const items=schedules.flatMap(({loan,schedule}:any)=>(schedule.schedule||[])
      .filter((row:any)=>String(row.dueDate).slice(0,10)===selectedDate)
      .map((row:any)=>({
        loanId:loan.id,clientId:loan.customerId,customerName:[loan.customer?.firstName,loan.customer?.middleName,loan.customer?.lastName].filter(Boolean).join(' '),
        assignedStaffId:loan.customer?.assignedStaffId||null,assignedStaffName:loan.customer?.assignedStaff?[loan.customer.assignedStaff.firstName,loan.customer.assignedStaff.lastName].filter(Boolean).join(' '):null,branchId:loan.customer?.branchId||null,branchName:loan.customer?.branch?.name||null,
        installmentNumber:row.installmentNumber,dueDate:row.dueDate,amountDue:Number(row.amount||0),
        paidAmount:Number(row.paidAmount||0),outstandingAmount:Number(row.remainingAmount||0),
        status:row.status==='PAID'?'PAID':'NOT_PAID',overdue:row.status==='OVERDUE',
      })));
    const paid=items.filter((row:any)=>row.status==='PAID');
    const unpaid=items.filter((row:any)=>row.status!=='PAID');
    return {date:selectedDate,items,totalInstallments:items.length,paidCount:paid.length,unpaidCount:unpaid.length,
      totalDue:items.reduce((sum:number,row:any)=>sum+row.amountDue,0),
      totalPaid:items.reduce((sum:number,row:any)=>sum+row.paidAmount,0),
      totalOutstanding:items.reduce((sum:number,row:any)=>sum+row.outstandingAmount,0)};
  }
  @Get() @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER') async findAll(@Req() req:any){const rows=await this.loansService.findAll();return this.accessScope.filterList(req.user,'loans',rows);}
  @Get(':id/schedule') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER') async getSchedule(@Param('id') id:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.getRepaymentSchedule(id);}
  @Get(':id') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER') async findOne(@Param('id') id:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.findOne(id);}
  @Patch(':id') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER') async update(@Param('id') id:string,@Body() dto:UpdateLoanDto,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.update(id,dto);}
  @Delete(':id') @Roles('SUPER_ADMIN','ADMIN') async remove(@Param('id') id:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.remove(id);}
  @Post(':id/submit-disbursement') @Roles('CREDIT_OFFICER') async submitDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:any){await this.accessScope.assertLoan(req.user,id);return this.loanDisbursementService.submitForBranchReview(id,req.user,body);}
  @Post(':id/approve-disbursement') @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN') async approveDisbursement(@Param('id') id:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);await this.permissions.assert(req.user.role,'LOAN_DISBURSE');return this.loanDisbursementService.approveAndDisburse(id,req.user);}
  @Post(':id/reject-disbursement') @Roles('BRANCH_MANAGER','ADMIN','SUPER_ADMIN') async rejectDisbursement(@Param('id') id:string,@Req() req:any,@Body() body:{reason?:string}){await this.accessScope.assertLoan(req.user,id);return this.loanDisbursementService.reject(id,req.user,body?.reason);}
  @Get(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','REGIONAL_MANAGER','DIVISIONAL_MANAGER','MONITORING_TEAM','AUDITOR','AREA_MANAGER','BRANCH_MANAGER','CREDIT_OFFICER','TELLER','LOAN_OFFICER') async findGuarantors(@Param('id') id:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.findGuarantors(id);}
  @Post(':id/guarantors') @Roles('SUPER_ADMIN','ADMIN','CREDIT_OFFICER') async addGuarantor(@Param('id') id:string,@Body() dto:CreateGuarantorDto,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.addGuarantor(id,dto);}
  @Patch(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER') async updateGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string,@Body() dto:Partial<CreateGuarantorDto>,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.updateGuarantor(id,guarantorId,dto);}
  @Delete(':id/guarantors/:guarantorId') @Roles('SUPER_ADMIN','ADMIN') async removeGuarantor(@Param('id') id:string,@Param('guarantorId') guarantorId:string,@Req() req:any){await this.accessScope.assertLoan(req.user,id);return this.loansService.removeGuarantor(id,guarantorId);}
}
