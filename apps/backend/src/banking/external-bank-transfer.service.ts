import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NibssService } from './nibss.service';
import { FlutterwaveService } from './flutterwave.service';

@Injectable()
export class ExternalBankTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly nibssService: NibssService,
    private readonly flutterwaveService: FlutterwaveService,
  ) {}

  private normalizeName(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  }

  private namesMatch(customerName: string, accountName: string) {
    const customer = this.normalizeName(customerName);
    const beneficiary = this.normalizeName(accountName);
    if (!customer || !beneficiary) return false;
    if (customer === beneficiary) return true;
    const customerParts = customer.split(' ').filter(Boolean);
    return customerParts.length >= 2 && customerParts.every((part) => beneficiary.includes(part));
  }

  async nameEnquiry(bankCode: string, accountNumber: string) {
    const provider = (process.env.BANK_TRANSFER_PROVIDER || 'NIBSS').trim().toUpperCase();
    if (provider === 'FLUTTERWAVE') {
      return this.flutterwaveService.nameEnquiry(bankCode, accountNumber);
    }
    return this.nibssService.nameEnquiry(bankCode, accountNumber);
  }

  async transfer(input: { customerId: string; bankCode: string; accountNumber: string; accountName: string; amount: number; description?: string }) {
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const accountNumber = String(input.accountNumber || '').replace(/\D/g, '');
    const accountName = String(input.accountName || '').trim();
    if (!/^\d{10}$/.test(accountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Transfer amount must be greater than zero');
    if (!accountName) throw new BadRequestException('Verified beneficiary account name is required');

    const customer = await this.prisma.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    const customerName = `${customer.firstName} ${customer.lastName}`;
    if (!this.namesMatch(customerName, accountName)) throw new BadRequestException('Beneficiary account name does not match the PWFB customer name');

    const wallet = await this.prisma.customerWallet.findUnique({ where: { customerId: input.customerId } });
    if (!wallet) throw new NotFoundException('Customer wallet not found');
    if (wallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
    if (wallet.balance < amount) throw new BadRequestException('Insufficient wallet balance');

    const provider = (process.env.BANK_TRANSFER_PROVIDER || 'NIBSS').trim().toUpperCase();
    const xref = `${provider === 'FLUTTERWAVE' ? 'FLW' : 'NIP'}-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const providerResult = provider === 'FLUTTERWAVE'
      ? await this.flutterwaveService.transfer({
          bankCode: input.bankCode,
          accountNumber,
          accountName,
          amount,
          narration: input.description || `PWFB transfer to ${accountName}`,
          reference: xref,
        })
      : await this.nibssService.transfer({
          bankCode: input.bankCode,
          accountNumber,
          amount,
          narration: input.description || `PWFB transfer to ${accountName}`,
          xref,
        });

    return this.prisma.$transaction(async (tx) => {
      const currentWallet = await tx.customerWallet.findUnique({ where: { customerId: input.customerId } });
      if (!currentWallet || currentWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
      if (currentWallet.balance < amount) throw new BadRequestException('Insufficient wallet balance after provider acceptance');
      const newBalance = Math.round((currentWallet.balance - amount) * 100) / 100;
      const updated = await tx.customerWallet.updateMany({
        where: { id: currentWallet.id, status: 'ACTIVE', balance: { gte: amount } },
        data: { balance: newBalance },
      });
      if (updated.count !== 1) throw new BadRequestException('Transfer could not be completed because the wallet balance changed');

      const providerStatus = String((providerResult as any)?.status ?? '').toUpperCase();
      const transactionStatus = provider === 'FLUTTERWAVE' && providerStatus !== 'SUCCESSFUL' ? 'PENDING' : 'COMPLETED';
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
