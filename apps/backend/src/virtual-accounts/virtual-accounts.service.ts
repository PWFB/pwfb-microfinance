import { Inject, Injectable, Logger } from '@nestjs/common';
import { CreateVirtualAccountInput, VIRTUAL_ACCOUNT_PROVIDER, VirtualAccountProvider } from './virtual-accounts.types';

@Injectable()
export class VirtualAccountsService {
  private readonly logger = new Logger(VirtualAccountsService.name);

  constructor(
    @Inject(VIRTUAL_ACCOUNT_PROVIDER)
    private readonly provider: VirtualAccountProvider,
  ) {}

  async provision(input: CreateVirtualAccountInput) {
    try {
      const account = await this.provider.createVirtualAccount(input);
      this.logger.log(`Virtual account provisioned for customer ${input.customerId}: ${account.accountNumber}`);
      return { status: 'ACTIVE' as const, ...account };
    } catch (error) {
      this.logger.warn(`Virtual account provisioning pending for customer ${input.customerId}`);
      return { status: 'PENDING' as const, error: error instanceof Error ? error.message : 'Provider unavailable' };
    }
  }
}
