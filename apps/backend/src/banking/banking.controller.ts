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
