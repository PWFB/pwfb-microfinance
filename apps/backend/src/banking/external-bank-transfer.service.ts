import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NibssService } from './nibss.service';
import { FlutterwaveService } from './flutterwave.service';
import { PaystackService } from './paystack.service';

@Injectable()
export class ExternalBankTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nibssService: NibssService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly paystackService: PaystackService,
  ) {}

  private provider() {
    return (process.env.BANK_TRANSFER_PROVIDER || 'NIBSS').trim().toUpperCase();
  }

  private normalizeName(value: string) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private namesMatch(customerName: string, accountName: string) {
    const customer = this.normalizeName(customerName);
    const beneficiary = this.normalizeName(accountName);
    if (!customer || !beneficiary) return false;
    if (customer === beneficiary) return true;

    const customerParts = customer.split(' ').filter(Boolean);
    const beneficiaryParts = beneficiary.split(' ').filter(Boolean);
    if (customerParts.length < 2 || beneficiaryParts.length < 2) return false;

    // Require every part of the complete PWFB customer name to be present in
    // the bank-verified beneficiary name. This prevents a partial-name match.
    return customerParts.every((part) => beneficiaryParts.includes(part));
  }

  async listInstitutions() {
    const provider = this.provider();
    if (provider === 'FLUTTERWAVE') {
      return this.flutterwaveService.listBanks('NG');
    }
    return this.prisma.bankInstitution.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  }

  async searchInstitutions(search?: string) {
    const provider = this.provider();
    const query = String(search || '').trim().toLowerCase();
    if (provider === 'FLUTTERWAVE') {
      const banks = await this.flutterwaveService.listBanks('NG');
      return query
        ? banks.filter((bank) => bank.name.toLowerCase().includes(query) || bank.code.toLowerCase().includes(query))
        : banks;
    }
    return this.prisma.bankInstitution.findMany({
      where: {
        active: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async nameEnquiry(bankCode: string, accountNumber: string) {
    const provider = this.provider();
    if (provider === 'PAYSTACK') {
      return this.paystackService.resolveBankAccount(bankCode, accountNumber);
    }
    if (provider === 'FLUTTERWAVE') {
      return this.flutterwaveService.nameEnquiry(bankCode, accountNumber);
    }
    return this.nibssService.nameEnquiry(bankCode, accountNumber);
  }

  async transfer(input: { customerId: string; bankCode: string; accountNumber: string; accountName: string; amount: number; description?: string }) {
    const bankCode = String(input.bankCode || '').trim();
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    const accountName = String(input.accountName || '').trim();
    if (!bankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    if (!accountName) throw new BadRequestException('Verified beneficiary account name is required');

    const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const customerName = [customer.firstName, customer.middleName, customer.lastName]
      .filter(Boolean)
      .join(' ');
    if (!this.namesMatch(customerName, accountName)) throw new BadRequestException('Beneficiary account name does not match the PWFB customer name');

    const wallet = await this.prisma.customerWallet.findUnique({ where: { customerId: input.customerId } });
    if (!wallet) throw new NotFoundException('Customer wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
    if (wallet.balance < amount) throw new BadRequestException('Insufficient wallet balance');

    const provider = this.provider();
    const xref = `${provider === 'FLUTTERWAVE' ? 'FLW' : provider === 'PAYSTACK' ? 'PAY' : 'NIP'}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const providerResult = provider === 'PAYSTACK'
      ? await this.paystackService.transferToBank({ bankCode, accountNumber, accountName, amount, narration: input.description || `PWFB transfer to ${accountName}`, reference: xref })
      : provider === 'FLUTTERWAVE'
        ? await this.flutterwaveService.transfer({ bankCode, accountNumber, accountName, amount, narration: input.description || `PWFB transfer to ${accountName}`, reference: xref })
        : await this.nibssService.transfer({ bankCode, accountNumber, amount, narration: input.description || `PWFB transfer to ${accountName}`, xref });

    return this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.customerWallet.findUnique({ where: { customerId: input.customerId } });
      if (!currentWallet || currentWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
      if (currentWallet.balance < amount) throw new BadRequestException('Insufficient wallet balance after provider acceptance');
      const newBalance = Math.round((currentWallet.balance - amount) * 100) / 100;
      const updated = await tx.customerWallet.updateMany({ where: { id: currentWallet.id, status: 'ACTIVE', balance: { gte: amount } }, data: { balance: newBalance } });
      if (updated.count !== 1) throw new BadRequestException('Transfer could not be completed because the wallet balance changed');

      const providerStatus = String((providerResult as any)?.status ?? '').toUpperCase();
      const transactionStatus = (provider === 'FLUTTERWAVE' || provider === 'PAYSTACK') && providerStatus !== 'SUCCESSFUL' && providerStatus !== 'SUCCESS' ? 'PENDING' : 'COMPLETED';
      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: input.customerId,
          type: 'WITHDRAWAL',
          amount,
          previousBalance: currentWallet.balance,
          newBalance,
          reference: xref,
          description: input.description || `Bank transfer to ${accountName}`,
          provider,
          providerReference: String((providerResult as any)?.providerReference ?? (providerResult as any)?.transactionReference ?? xref),
          status: transactionStatus as any,
          processedAt: transactionStatus === 'COMPLETED' ? new Date() : null,
        },
      });
      return { wallet: { ...currentWallet, balance: newBalance }, transaction, provider: providerResult };
    });
  }
}
