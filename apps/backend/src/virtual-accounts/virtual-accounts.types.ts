export type VirtualAccountStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'FAILED';

export interface CreateVirtualAccountInput {
  customerId: string;
  branchId: string;
  accountName: string;
  customerReference: string;
}

export interface CreatedVirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode?: string;
  providerReference: string;
}

export interface VirtualAccountProvider {
  createVirtualAccount(input: CreateVirtualAccountInput): Promise<CreatedVirtualAccount>;
}
