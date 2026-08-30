import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { BankingService } from './banking.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { ExternalBankTransferService } from './external-bank-transfer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from '../permissions/permissions.service';

const BANKING_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','LOAN_OFFICER','TELLER','AUDITOR','STAFF','CUSTOMER'] as const;

@Controller('banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankingController {
  constructor(private readonly bankingService: BankingService, private readonly customerVirtualAccountService: CustomerVirtualAccountService, private readonly externalBankTransferService: ExternalBankTransferService, private readonly permissionsService: PermissionsService) {}
  @Get('institutions') @Roles(...BANKING_ROLES) listInstitutions(){return this.externalBankTransferService.listInstitutions()}
  @Get('institutions/search') @Roles(...BANKING_ROLES) searchInstitutions(@Query('q') q?:string){return this.externalBankTransferService.searchInstitutions(q)}
  @Get('account-name') @Roles(...BANKING_ROLES) nameEnquiry(@Query('bankCode') bankCode:string,@Query('accountNumber') accountNumber:string){return this.externalBankTransferService.nameEnquiry(bankCode,accountNumber)}
  private assertCustomerAccess(customerId:string,user:any){if(user?.role==='CUSTOMER'&&(!user.customerId||user.customerId!==customerId))throw new ForbiddenException('You can only access your own customer account')}
  private async assertPermission(user:any,permission:'WALLET_DEPOSIT'|'WALLET_WITHDRAWAL'){const role=String(user?.role||'').toUpperCase();if(!(await this.permissionsService.get(role,permission)))throw new ForbiddenException(`Your role does not have ${permission==='WALLET_DEPOSIT'?'deposit':'withdrawal'} permission`)}
  @Get('customers/:customerId/accounts') @Roles(...BANKING_ROLES) getCustomerAccounts(@Param('customerId') customerId:string,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.bankingService.getCustomerAccounts(customerId)}
  @Post('customers/:customerId/accounts') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','STAFF','CUSTOMER') addCustomerAccount(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.bankingService.addCustomerAccount({customerId,...body})}
  @Get('customers/:customerId/virtual-accounts') @Roles(...BANKING_ROLES) getCustomerVirtualAccounts(@Param('customerId') customerId:string,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.customerVirtualAccountService.list(customerId)}
  @Post('customers/:customerId/virtual-accounts/ensure') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','STAFF','CUSTOMER') ensureCustomerVirtualAccount(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.customerVirtualAccountService.ensure(customerId,body?.institutionId)}
  @Get('customers/:customerId/wallet') @Roles(...BANKING_ROLES) getCustomerWallet(@Param('customerId') customerId:string,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.bankingService.getCustomerWallet(customerId)}
  @Get('customers/:customerId/transactions') @Roles(...BANKING_ROLES) getCustomerTransactions(@Param('customerId') customerId:string,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.bankingService.getCustomerTransactions(customerId)}
  @Post('customers/:customerId/deposit') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF','CUSTOMER') async deposit(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);await this.assertPermission(req.user,'WALLET_DEPOSIT');return this.bankingService.deposit(customerId,body)}
  @Post('customers/:customerId/withdraw') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF','CUSTOMER') async withdraw(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);await this.assertPermission(req.user,'WALLET_WITHDRAWAL');const bankCode=String(body.bankCode||body.bank_code||'').trim();const accountNumber=String(body.accountNumber||'').replace(/\D/g,'');if(bankCode&&accountNumber)return this.externalBankTransferService.transfer({customerId,bankCode,accountNumber,accountName:body.accountName,amount:body.amount,description:body.description});return this.bankingService.withdraw(customerId,body)}
  @Post('customers/:customerId/bank-transfer') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','STAFF','CUSTOMER') async bankTransfer(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);await this.assertPermission(req.user,'WALLET_WITHDRAWAL');const bankCode=String(body.bankCode||body.bank_code||'').trim();const accountNumber=String(body.accountNumber||'').replace(/\D/g,'');if(!bankCode||!accountNumber)throw new BadRequestException('Select a destination bank and enter a valid 10-digit account number');return this.externalBankTransferService.transfer({customerId,bankCode,accountNumber,accountName:body.accountName,amount:body.amount,description:body.description||body.narration})}
  @Post('customers/:customerId/transfer') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','STAFF','CUSTOMER') transfer(@Param('customerId') customerId:string,@Body() body:any,@Req() req:any){this.assertCustomerAccess(customerId,req.user);return this.bankingService.transfer(customerId,body)}
  @Get('branches/:branchId/virtual-accounts') @Roles(...BANKING_ROLES) getBranchVirtualAccounts(@Param('branchId') branchId:string){return this.bankingService.getBranchVirtualAccounts(branchId)}
  @Post('branches/:branchId/virtual-accounts') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF') generateBranchVirtualAccount(@Param('branchId') branchId:string,@Body() body:{institutionId:string}){return this.bankingService.generateBranchVirtualAccount(branchId,body.institutionId)}
  @Post('branch-virtual-account/deposit') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF') recordBranchDeposit(@Body() body:{accountNumber:string;amount:number;reference?:string;narration?:string}){return this.bankingService.recordBranchDeposit(body)}
  @Get('branches/:branchId/ledger') @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','AUDITOR','TELLER','STAFF') getBranchLedger(@Param('branchId') branchId:string){return this.bankingService.getBranchLedger(branchId)}
}
