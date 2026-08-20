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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('banking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  @Get('institutions')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
    'CUSTOMER',
  )
  listInstitutions() {
    return this.bankingService.listInstitutions();
  }

  @Get('institutions/search')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
    'CUSTOMER',
  )
  searchInstitutions(@Query('q') q?: string) {
    return this.bankingService.searchInstitutions(q);
  }

  private assertCustomerAccess(
    customerId: string,
    user: any,
  ) {
    if (user?.role === 'CUSTOMER') {
      if (!user.customerId || user.customerId !== customerId) {
        throw new ForbiddenException(
          'You can only access your own customer account',
        );
      }
    }
  }

  @Get('customers/:customerId/accounts')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
    'CUSTOMER',
  )
  getCustomerAccounts(
    @Param('customerId') customerId: string,
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.getCustomerAccounts(customerId);
  }

  @Post('customers/:customerId/accounts')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'STAFF',
    'CUSTOMER',
  )
  addCustomerAccount(
    @Param('customerId') customerId: string,
    @Body()
    body: {
      institutionId: string;
      accountNumber: string;
      accountName?: string;
      isPrimary?: boolean;
    },
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.addCustomerAccount({
      customerId,
      ...body,
    });
  }

  @Get('customers/:customerId/wallet')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
    'CUSTOMER',
  )
  getCustomerWallet(
    @Param('customerId') customerId: string,
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.getCustomerWallet(customerId);
  }

  @Get('customers/:customerId/transactions')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'CUSTOMER_SERVICE',
    'LOAN_OFFICER',
    'TELLER',
    'AUDITOR',
    'STAFF',
    'CUSTOMER',
  )
  getCustomerTransactions(
    @Param('customerId') customerId: string,
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.getCustomerTransactions(customerId);
  }

  @Post('customers/:customerId/deposit')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'STAFF',
    'CUSTOMER',
  )
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
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.deposit(customerId, body);
  }

  @Post('customers/:customerId/withdraw')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'STAFF',
    'CUSTOMER',
  )
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
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.withdraw(customerId, body);
  }

  @Post('customers/:customerId/transfer')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'STAFF',
    'CUSTOMER',
  )
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
    @Req() req: any,
  ) {
    this.assertCustomerAccess(customerId, req.user);

    return this.bankingService.transfer(customerId, body);
  }

  @Get('branches/:branchId/virtual-accounts')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'STAFF',
  )
  getBranchVirtualAccounts(
    @Param('branchId') branchId: string,
  ) {
    return this.bankingService.getBranchVirtualAccounts(branchId);
  }

  @Post('branches/:branchId/virtual-accounts')
  @Roles(
    'SUPER_ADMIN',
    'ADMIN',
    'BRANCH_MANAGER',
    'TELLER',
    'STAFF',
  )
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
