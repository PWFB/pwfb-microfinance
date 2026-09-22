import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NibssService } from './nibss.service';
import { FlutterwaveService } from './flutterwave.service';
import { PaystackService } from './paystack.service';

@Injectable()
export class ExternalBankTransferService {
  constructor(private readonly prisma: PrismaService, private readonly nibssService: NibssService, private readonly flutterwaveService: FlutterwaveService, private readonly paystackService: PaystackService) {}

  private hasFlutterwaveLiveCredentials() {
    return Boolean((process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY)?.trim());
  }

  private hasPaystackCredentials() {
    return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
  }

  private providerIsUsable(provider: string) {
    if (provider === 'PAYSTACK') return this.hasPaystackCredentials();
    if (provider === 'FLUTTERWAVE') return this.hasFlutterwaveLiveCredentials();
    if (provider === 'NIBSS') return true;
    return false;
  }

  private configuredProviders(): string[] {
    const multiple = String(process.env.BANK_TRANSFER_PROVIDERS || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    const single = String(process.env.BANK_TRANSFER_PROVIDER || '').trim().toUpperCase();
    const requested = multiple.length ? multiple : single ? [single] : [];
    const valid = requested.filter((provider) => ['FLUTTERWAVE', 'PAYSTACK', 'NIBSS'].includes(provider));
    const usable = valid.filter((provider) => this.providerIsUsable(provider));
    if (usable.length) return [...new Set(usable)];

    // If Render still has the old FLUTTERWAVE provider setting but no live
    // Flutterwave secret, automatically use the connected Paystack account.
    if (this.hasPaystackCredentials()) return ['PAYSTACK'];
    if (this.hasFlutterwaveLiveCredentials()) return ['FLUTTERWAVE'];
    if (process.env.FLUTTERWAVE_CLIENT_ID?.trim() && process.env.FLUTTERWAVE_CLIENT_SECRET?.trim()) return ['FLUTTERWAVE'];
    return ['NIBSS'];
  }

  private provider() { return this.configuredProviders()[0]; }
  currentProvider() { return this.provider(); }
  currentProviders() { return this.configuredProviders(); }
  private readonly fallbackNigeriaBanks = [
    { name: 'Access Bank', shortName: 'Access Bank', code: '044', provider: 'PAYSTACK' },
    { name: 'Citibank Nigeria', shortName: 'Citibank', code: '023', provider: 'PAYSTACK' },
    { name: 'Ecobank Nigeria', shortName: 'Ecobank', code: '050', provider: 'PAYSTACK' },
    { name: 'Fidelity Bank', shortName: 'Fidelity', code: '070', provider: 'PAYSTACK' },
    { name: 'First Bank of Nigeria', shortName: 'FirstBank', code: '011', provider: 'PAYSTACK' },
    { name: 'First City Monument Bank', shortName: 'FCMB', code: '214', provider: 'PAYSTACK' },
    { name: 'Globus Bank', shortName: 'Globus', code: '103', provider: 'PAYSTACK' },
    { name: 'Guaranty Trust Bank', shortName: 'GTBank', code: '058', provider: 'PAYSTACK' },
    { name: 'Heritage Bank', shortName: 'Heritage', code: '030', provider: 'PAYSTACK' },
    { name: 'Jaiz Bank', shortName: 'Jaiz', code: '301', provider: 'PAYSTACK' },
    { name: 'Keystone Bank', shortName: 'Keystone', code: '082', provider: 'PAYSTACK' },
    { name: 'Kuda Microfinance Bank', shortName: 'Kuda', code: '090267', provider: 'PAYSTACK' },
    { name: 'Moniepoint Microfinance Bank', shortName: 'Moniepoint', code: '090405', provider: 'PAYSTACK' },
    { name: 'Opay', shortName: 'OPay', code: '999992', provider: 'PAYSTACK' },
    { name: 'PalmPay', shortName: 'PalmPay', code: '999991', provider: 'PAYSTACK' },
    { name: 'Polaris Bank', shortName: 'Polaris', code: '076', provider: 'PAYSTACK' },
    { name: 'Premium Trust Bank', shortName: 'PremiumTrust', code: '000031', provider: 'PAYSTACK' },
    { name: 'Providus Bank', shortName: 'Providus', code: '101', provider: 'PAYSTACK' },
    { name: 'Stanbic IBTC Bank', shortName: 'Stanbic IBTC', code: '221', provider: 'PAYSTACK' },
    { name: 'Sterling Bank', shortName: 'Sterling', code: '232', provider: 'PAYSTACK' },
    { name: 'Union Bank of Nigeria', shortName: 'Union Bank', code: '032', provider: 'PAYSTACK' },
    { name: 'United Bank for Africa', shortName: 'UBA', code: '033', provider: 'PAYSTACK' },
    { name: 'Unity Bank', shortName: 'Unity', code: '215', provider: 'PAYSTACK' },
    { name: 'Wema Bank', shortName: 'Wema', code: '035', provider: 'PAYSTACK' },
    { name: 'Zenith Bank', shortName: 'Zenith', code: '057', provider: 'PAYSTACK' },
  ];

  private normalizeName(value: string) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }

  private bankMatches(bank: { name?: string; shortName?: string; code?: string }, query: string) {
    const q = this.normalizeName(query);
    if (!q) return true;
    return [bank.name, bank.shortName, bank.code].some((value) => this.normalizeName(String(value || '')).includes(q));
  }

  private mergeBanks(...sources: any[][]) {
    const merged = new Map<string, any>();
    for (const source of sources) {
      for (const bank of source || []) {
        const name = String(bank?.name ?? bank?.bankName ?? bank?.institutionName ?? '').trim();
        const code = String(bank?.code ?? bank?.bankCode ?? '').trim();
        if (!name || !code) continue;
        const key = code || this.normalizeName(name);
        if (!merged.has(key)) merged.set(key, { ...bank, name, code });
      }
    }
    return [...merged.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
  }

  async listInstitutions() {
    const provider = this.provider();
    let providerBanks: any[] = [];
    let localBanks: any[] = [];
    try {
      if (provider === 'PAYSTACK') {
        providerBanks = (await this.paystackService.listBanks()).map((bank) => ({ ...bank, provider }));
      } else if (provider === 'FLUTTERWAVE') {
        providerBanks = (await this.flutterwaveService.listBanks('NG')).map((bank) => ({ ...bank, provider }));
      }
    } catch {
      // Use local/fallback references when the provider list is temporarily unavailable.
    }
    try {
      localBanks = await this.prisma.bankInstitution.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    } catch {
      localBanks = [];
    }
    return this.mergeBanks(providerBanks, localBanks, this.fallbackNigeriaBanks);
  }

  async searchInstitutions(search?: string) {
    const query = String(search || '').trim();
    const banks = await this.listInstitutions();
    return banks.filter((bank) => this.bankMatches(bank, query));
  }

  private async resolveWithProvider(provider: string, bankCode: string, accountNumber: string) {
    if (provider === 'PAYSTACK') return this.paystackService.resolveBankAccount(bankCode, accountNumber);
    if (provider === 'FLUTTERWAVE') return this.flutterwaveService.nameEnquiry(bankCode, accountNumber);
    return this.nibssService.nameEnquiry(bankCode, accountNumber);
  }

  async nameEnquiry(bankCode: string, accountNumber: string, providerHint?: string) {
    const normalizedBankCode = String(bankCode || '').trim();
    const normalizedAccountNumber = String(accountNumber || '').replace(/\D/g, '');
    if (!normalizedBankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(normalizedAccountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    const requestedProvider = String(providerHint || '').trim().toUpperCase();
    const primaryProvider = this.provider();
    const providers = requestedProvider && this.providerIsUsable(requestedProvider) ? [requestedProvider] : [primaryProvider];
    if (providers.some((provider) => !['FLUTTERWAVE', 'PAYSTACK', 'NIBSS'].includes(provider))) throw new BadRequestException('Unsupported bank verification provider');
    const failures: string[] = [];
    for (const provider of providers) {
      try {
        const result = await this.resolveWithProvider(provider, normalizedBankCode, normalizedAccountNumber);
        const verifiedName = String(result?.accountName || '').trim();
        if (!verifiedName) throw new BadRequestException('Bank provider did not return a verified account name');
        const providerAccountNumber = String(result?.accountNumber || normalizedAccountNumber).replace(/\D/g, '');
        if (providerAccountNumber !== normalizedAccountNumber) throw new BadRequestException('Bank provider returned a different account number');
        return { ...result, accountNumber: normalizedAccountNumber, accountName: verifiedName, verified: true, provider };
      } catch (error) {
        failures.push(`${provider}: ${error instanceof Error ? error.message : 'verification failed'}`);
      }
    }
    throw new BadRequestException(`Bank account verification failed. ${failures.join(' | ')}`);
  }

  async verifyCustomerBankAccount(customerId: string, bankCode: string, accountNumber: string, providerHint?: string) {
    const id = String(customerId || '').trim();
    if (!id) throw new BadRequestException('PWFB customer is required for name verification');
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    if (!customer) throw new NotFoundException('PWFB customer not found');
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    if (!customerName) throw new BadRequestException('PWFB customer name is not available for bank verification');
    const result = await this.nameEnquiry(bankCode, accountNumber, providerHint);
    const accountParts = new Set(this.normalizeName(result.accountName).split(' ').filter(Boolean));
    const matchCount = [...new Set(this.normalizeName(customerName).split(' ').filter(Boolean))].filter((part) => accountParts.has(part)).length;
    if (matchCount < 2) throw new BadRequestException(`Bank account verification failed: the verified account name (${result.accountName}) does not match at least two names on the PWFB customer profile (${customerName}).`);
    return { ...result, registeredCustomerName: customerName, nameMatchCount: matchCount, nameMatch: true, verification: 'VERIFIED', beneficiaryType: 'PWFB_CUSTOMER' };
  }

  async transferToVerifiedAccount(input: { bankCode: string; accountNumber: string; accountName: string; amount: number; narration: string; reference: string; provider?: string }) {
    const requestedProvider = String(input.provider || '').trim().toUpperCase();
    const provider = requestedProvider && this.providerIsUsable(requestedProvider) ? requestedProvider : this.provider();
    if (provider === 'PAYSTACK') return this.paystackService.transferToBank(input);
    if (provider === 'FLUTTERWAVE') return this.flutterwaveService.transfer(input);
    return this.nibssService.transfer({ bankCode: input.bankCode, accountNumber: input.accountNumber, amount: input.amount, narration: input.narration, xref: input.reference });
  }

  async transfer(input: { customerId: string; bankCode: string; accountNumber: string; accountName?: string; amount: number; description?: string; provider?: string }) {
    const bankCode = String(input.bankCode || '').trim();
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    if (!bankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    const verified = await this.verifyCustomerBankAccount(input.customerId, bankCode, accountNumber, input.provider);
    const verifiedAccountName = String(verified.accountName || '').trim();
    const wallet = await this.prisma.customerWallet.findUnique({ where: { customerId: input.customerId } });
    if (!wallet) throw new NotFoundException('Customer wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
    if (wallet.balance < amount) throw new BadRequestException('Insufficient wallet balance');
    const provider = String(verified.provider || input.provider || this.provider()).trim().toUpperCase();
    const xref = `${provider === 'FLUTTERWAVE' ? 'FLW' : provider === 'PAYSTACK' ? 'PAY' : 'NIP'}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const providerResult = await this.transferToVerifiedAccount({ bankCode, accountNumber, accountName: verifiedAccountName, amount, narration: input.description || `PWFB withdrawal to ${verifiedAccountName}`, reference: xref, provider });
    return this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.customerWallet.findUnique({ where: { id: wallet.id } });
      if (!currentWallet || currentWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
      if (currentWallet.balance < amount) throw new BadRequestException('Insufficient wallet balance after provider acceptance');
      const newBalance = Math.round((currentWallet.balance - amount) * 100) / 100;
      const updated = await tx.customerWallet.updateMany({ where: { id: currentWallet.id, status: 'ACTIVE', balance: { gte: amount } }, data: { balance: newBalance } });
      if (updated.count !== 1) throw new BadRequestException('Withdrawal could not be completed because the wallet balance changed');
      const providerStatus = String((providerResult as any)?.status ?? '').toUpperCase();
      const transactionStatus = (provider === 'FLUTTERWAVE' || provider === 'PAYSTACK') && providerStatus !== 'SUCCESSFUL' && providerStatus !== 'SUCCESS' ? 'PENDING' : 'COMPLETED';
      const transaction = await tx.walletTransaction.create({ data: { customerId: input.customerId, type: 'WITHDRAWAL', amount, previousBalance: currentWallet.balance, newBalance, reference: xref, description: input.description || `Bank withdrawal to ${verifiedAccountName}`, provider, providerReference: String((providerResult as any)?.providerReference ?? (providerResult as any)?.transactionReference ?? xref), status: transactionStatus as any, processedAt: transactionStatus === 'COMPLETED' ? new Date() : null } });
      return { wallet: { ...currentWallet, balance: newBalance }, transaction, provider: providerResult, beneficiary: { accountNumber, accountName: verifiedAccountName, bankCode, verified: true, nameMatch: true, provider } };
    });
  }
}
