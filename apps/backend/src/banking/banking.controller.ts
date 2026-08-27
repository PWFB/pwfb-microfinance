import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';

import { BankingService } from './banking.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { ExternalBankTransferService } from './external-bank-transfer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const BANKING_ROLES = ['SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','LOAN_OFFICER','TELLER','AUDITOR','STAFF','CUSTOMER'] as const;

@Controller('banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankingController {
  constructor(
    private readonly bankingService: BankingService,
    private readonly customerVirtualAccountService: CustomerVirtualAccountService,
    private readonly externalBankTransferService: ExternalBankTransferService,
  ) {}

  @Get('institutions')
  @Roles(...BANKING_ROLES)
  listInstitutions() { return this.externalBankTransferService.listInstitutions(); }

  @Get('institutions/search')
  @Roles(...BANKING_ROLES)
  searchInstitutions(@Query('q') q?: string) { return this.externalBankTransferService.searchInstitutions(q); }

  @Get('account-name')
  @Roles(...BANKING_ROLES)
  nameEnquiry(@Query('bankCode') bankCode: string, @Query('accountNumber') accountNumber: string) {
    return this.externalBankTransferService.nameEnquiry(bankCode, accountNumber);
  }

  private assertCustomerAccess(customerId: string, user: any) {
    if (user?.role === 'CUSTOMER' && (!user.customerId || user.customerId !== customerId)) {
      throw new ForbiddenException('You can only access your own customer account');
    }
  }

  @Get('customers/:customerId/accounts')
  @Roles(...BANKING_ROLES)
  getCustomerAccounts(@Param('customerId') customerId: string, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.getCustomerAccounts(customerId);
  }

  @Post('customers/:customerId/accounts')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','STAFF','CUSTOMER')
  addCustomerAccount(@Param('customerId') customerId: string, @Body() body: { institutionId: string; accountNumber: string; accountName?: string; isPrimary?: boolean }, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.addCustomerAccount({ customerId, ...body });
  }

  @Get('customers/:customerId/virtual-accounts')
  @Roles(...BANKING_ROLES)
  getCustomerVirtualAccounts(@Param('customerId') customerId: string, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.customerVirtualAccountService.list(customerId);
  }

  @Post('customers/:customerId/virtual-accounts/ensure')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','CUSTOMER_SERVICE','STAFF','CUSTOMER')
  ensureCustomerVirtualAccount(@Param('customerId') customerId: string, @Body() body: { institutionId?: string }, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.customerVirtualAccountService.ensure(customerId, body?.institutionId);
  }

  @Get('customers/:customerId/wallet')
  @Roles(...BANKING_ROLES)
  getCustomerWallet(@Param('customerId') customerId: string, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.getCustomerWallet(customerId);
  }

  @Get('customers/:customerId/transactions')
  @Roles(...BANKING_ROLES)
  getCustomerTransactions(@Param('customerId') customerId: string, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.getCustomerTransactions(customerId);
  }

  @Post('customers/:customerId/deposit')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF','CUSTOMER')
  deposit(@Param('customerId') customerId: string, @Body() body: { amount: number; description?: string; reference?: string; branchId?: string; staffId?: string }, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.deposit(customerId, body);
  }

  @Post('customers/:customerId/withdraw')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF','CUSTOMER')
  withdraw(@Param('customerId') customerId: string, @Body() body: { amount: number; description?: string; reference?: string; branchId?: string; staffId?: string }, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.withdraw(customerId, body);
  }

  @Post('customers/:customerId/bank-transfer')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','STAFF','CUSTOMER')
  bankTransfer(
    @Param('customerId') customerId: string,
    @Body() body: {
      bankCode?: string;
      bank_code?: string;
      accountNumber: string;
      accountName?: string;
      amount: number;
      description?: string;
      narration?: string;
    },
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);
    const bankCode = String(body.bankCode || body.bank_code || '').trim();
    return this.externalBankTransferService.transfer({
      customerId,
      bankCode,
      accountNumber: body.accountNumber,
      accountName: body.accountName,
      amount: body.amount,
      description: body.description || body.narration,
    });
  }

  @Post('customers/:customerId/transfer')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','STAFF','CUSTOMER')
  transfer(@Param('customerId') customerId: string, @Body() body: { recipientCustomerId: string; amount: number; description?: string; reference?: string; branchId?: string; staffId?: string }, @Req() req: any) {
    this.assertCustomerAccess(customerId, req.user);
    return this.bankingService.transfer(customerId, body);
  }

  @Get('branches/:branchId/virtual-accounts')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF')
  getBranchVirtualAccounts(@Param('branchId') branchId: string) { return this.bankingService.getBranchVirtualAccounts(branchId); }

  @Post('branches/:branchId/virtual-accounts')
  @Roles('SUPER_ADMIN','ADMIN','BRANCH_MANAGER','TELLER','STAFF')
  generateBranchVirtualAccount(@Param('branchId') branchId: string, @Body() body: { institutionId: string }) {
    return this.bankingService.generateBranchVirtualAccount(branchId, body.institutionId);
  }
}
