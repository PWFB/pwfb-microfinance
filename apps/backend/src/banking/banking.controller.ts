import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { BankingService } from './banking.service';

@Controller('banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('institutions')
  listInstitutions() {
    return this.bankingService.listInstitutions();
  }

  @Get('institutions/search')
  searchInstitutions(@Query('q') q?: string) {
    return this.bankingService.searchInstitutions(q);
  }

  @Get('customers/:customerId/accounts')
  getCustomerAccounts(@Param('customerId') customerId: string) {
    return this.bankingService.getCustomerAccounts(customerId);
  }

  @Post('customers/:customerId/accounts')
  addCustomerAccount(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      institutionId: string;
      accountNumber: string;
      accountName?: string;
      isPrimary?: boolean;
    },
  ) {
    return this.bankingService.addCustomerAccount({
      customerId,
      ...body,
    });
  }

  @Get('customers/:customerId/wallet')
  getCustomerWallet(@Param('customerId') customerId: string) {
    return this.bankingService.getCustomerWallet(customerId);
  }

  @Get('customers/:customerId/transactions')
  getCustomerTransactions(
    @Param('customerId') customerId: string,
  ) {
    return this.bankingService.getCustomerTransactions(customerId);
  }

  @Post('customers/:customerId/deposit')
  deposit(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      amount: number;
      description?: string;
      reference?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    return this.bankingService.deposit(customerId, body);
  }

  @Post('customers/:customerId/withdraw')
  withdraw(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      amount: number;
      description?: string;
      reference?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    return this.bankingService.withdraw(customerId, body);
  }

  @Post('customers/:customerId/transfer')
  transfer(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      recipientCustomerId: string;
      amount: number;
      description?: string;
      reference?: string;
      branchId?: string;
      staffId?: string;
    },
  ) {
    return this.bankingService.transfer(customerId, body);
  }

  @Get('branches/:branchId/virtual-accounts')
  getBranchVirtualAccounts(@Param('branchId') branchId: string) {
    return this.bankingService.getBranchVirtualAccounts(branchId);
  }

  @Post('branches/:branchId/virtual-accounts')
  generateBranchVirtualAccount(
    @Param('branchId') branchId: string,
    @Body() body: { institutionId: string },
  ) {
    return this.bankingService.generateBranchVirtualAccount(
      branchId,
      body.institutionId,
    );
  }
}
