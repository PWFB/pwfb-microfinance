import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NibssService } from './nibss.service';
import { FlutterwaveService } from './flutterwave.service';
import { PaystackService } from './paystack.service';

@Injectable()
export class ExternalBankTransferService {
  constructor(private readonly prisma: PrismaService, private readonly nibssService: NibssService, private readonly flutterwaveService: FlutterwaveService, private readonly paystackService: PaystackService) {}

  private configuredProviders(): string[] {
    const multiple = String(process.env.BANK_TRANSFER_PROVIDERS || '').split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
    const single = String(process.env.BANK_TRANSFER_PROVIDER || '').trim().toUpperCase();
    const requested = multiple.length ? multiple : single ? [single] : [];
    const available = requested.filter((provider) => ['FLUTTERWAVE', 'PAYSTACK', 'NIBSS'].includes(provider));
    if (available.length) return [...new Set(available)];
    if (process.env.FLUTTERWAVE_CLIENT_ID?.trim() && process.env.FLUTTERWAVE_CLIENT_SECRET?.trim()) return ['FLUTTERWAVE'];
    if (process.env.PAYSTACK_SECRET_KEY?.trim()) return ['PAYSTACK'];
    return ['NIBSS'];
  }

  private provider() { return this.configuredProviders()[0]; }
  currentProvider() { return this.provider(); }
  currentProviders() { return this.configuredProviders(); }
  private normalizeName(value: string) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }

  async listInstitutions() {
    const provider = this.provider();
    if (provider === 'PAYSTACK') return this.paystackService.listBanks();
    if (provider === 'FLUTTERWAVE') return this.flutterwaveService.listBanks('NG');
    return this.prisma.bankInstitution.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async searchInstitutions(search?: string) {
    const provider = this.provider();
    const query = String(search || '').trim().toLowerCase();
    if (provider === 'PAYSTACK') {
      const banks = await this.paystackService.listBanks();
      return query ? banks.filter((bank) => bank.name.toLowerCase().includes(query) || bank.code.toLowerCase().includes(query)) : banks;
    }
    if (provider === 'FLUTTERWAVE') {
      const banks = await this.flutterwaveService.listBanks('NG');
      return query ? banks.filter((bank) => bank.name.toLowerCase().includes(query) || bank.code.toLowerCase().includes(query)) : banks;
    }
    return this.prisma.bankInstitution.findMany({ where: { active: true, ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { shortName: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: { name: 'asc' } });
  }

  private async resolveWithProvider(provider: string, bankCode: string, accountNumber: string) {
    if (provider === 'PAYSTACK') return this.paystackService.resolveBankAccount(bankCode, accountNumber);
    if (provider === 'FLUTTERWAVE') return this.flutterwaveService.nameEnquiry(bankCode, accountNumber);
    return this.nibssService.nameEnquiry(bankCode, accountNumber);
  }

  async nameEnquiry(bankCode: string, accountNumber: string) {
    const normalizedBankCode = String(bankCode || '').trim();
    const normalizedAccountNumber = String(accountNumber || '').replace(/\D/g, '');
    if (!normalizedBankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(normalizedAccountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    const providers = this.configuredProviders();
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
    throw new BadRequestException(`Bank account verification failed with all configured providers. ${failures.join(' | ')}`);
  }

  async verifyCustomerBankAccount(customerId: string, bankCode: string, accountNumber: string) {
    const id = String(customerId || '').trim();
    if (!id) throw new BadRequestException('PWFB customer is required for name verification');
    const customer = await this.prisma.customer.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    if (!customer) throw new NotFoundException('PWFB customer not found');
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim();
    if (!customerName) throw new BadRequestException('PWFB customer name is not available for bank verification');
    const result = await this.nameEnquiry(bankCode, accountNumber);
    const accountParts = new Set(this.normalizeName(result.accountName).split(' ').filter(Boolean));
    const matchCount = [...new Set(this.normalizeName(customerName).split(' ').filter(Boolean))].filter((part) => accountParts.has(part)).length;
    if (matchCount < 2) throw new BadRequestException(`Bank account verification failed: the verified account name (${result.accountName}) does not match at least two names on the PWFB customer profile (${customerName}).`);
    return { ...result, registeredCustomerName: customerName, nameMatchCount: matchCount, nameMatch: true, verification: 'VERIFIED', beneficiaryType: 'PWFB_CUSTOMER' };
  }

  async transferToVerifiedAccount(input: { bankCode: string; accountNumber: string; accountName: string; amount: number; narration: string; reference: string }) {
    const provider = this.provider();
    if (provider === 'PAYSTACK') return this.paystackService.transferToBank(input);
    if (provider === 'FLUTTERWAVE') return this.flutterwaveService.transfer(input);
    return this.nibssService.transfer({ bankCode: input.bankCode, accountNumber: input.accountNumber, amount: input.amount, narration: input.narration, xref: input.reference });
  }

  async transfer(input: { customerId: string; bankCode: string; accountNumber: string; accountName?: string; amount: number; description?: string }) {
    const bankCode = String(input.bankCode || '').trim();
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    if (!bankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    const verified = await this.verifyCustomerBankAccount(input.customerId, bankCode, accountNumber);
    const verifiedAccountName = String(verified.accountName || '').trim();
    const wallet = await this.prisma.customerWallet.findUnique({ where: { customerId: input.customerId } });
    if (!wallet) throw new NotFoundException('Customer wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
    if (wallet.balance < amount) throw new BadRequestException('Insufficient wallet balance');
    const provider = this.provider();
    const xref = `${provider === 'FLUTTERWAVE' ? 'FLW' : provider === 'PAYSTACK' ? 'PAY' : 'NIP'}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const providerResult = await this.transferToVerifiedAccount({ bankCode, accountNumber, accountName: verifiedAccountName, amount, narration: input.description || `PWFB withdrawal to ${verifiedAccountName}`, reference: xref });
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
