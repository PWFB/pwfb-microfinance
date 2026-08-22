import { Injectable } from '@nestjs/common';
import { CreateVirtualAccountInput, CreatedVirtualAccount } from './virtual-accounts.types';

export abstract class VirtualAccountProvider {
  abstract createVirtualAccount(input: CreateVirtualAccountInput): Promise<CreatedVirtualAccount>;
}

/**
 * Safe default until a licensed banking/payment provider is configured.
 * It deliberately does not invent an account number: provisioning remains pending.
 */
@Injectable()
export class PendingVirtualAccountProvider extends VirtualAccountProvider {
  async createVirtualAccount(_input: CreateVirtualAccountInput): Promise<CreatedVirtualAccount> {
    throw new Error('No virtual account provider configured');
  }
}
