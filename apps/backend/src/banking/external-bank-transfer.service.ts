import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NibssService } from './nibss.service';

@Injectable()
export class ExternalBankTransferService {
  constructor(private readonly prisma: PrismaService, private readonly nibssService: NibssService) {}

  private providerAvailable(provider: string) {
    if (provider === 'PAYSTACK') return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
    if (provider === 'FLUTTERWAVE') return Boolean((process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY)?.trim());
    if (provider === 'NIBSS') return Boolean(process.env.NIBSS_CLIENT_ID?.trim() && process.env.NIBSS_CLIENT_KEY?.trim() && process.env.NIBSS_NAME_ENQUIRY_URL?.trim());
    return false;
  }

  private providerOrder(providerHint?: string) {
    const configured = [
      ...(providerHint ? [providerHint] : []),
      ...String(process.env.BANK_TRANSFER_PROVIDERS || '').split(','),
      process.env.BANK_TRANSFER_PROVIDER || '',
      'PAYSTACK',
      'FLUTTERWAVE',
      'NIBSS',
    ].map((value) => String(value).trim().toUpperCase()).filter((value) => ['PAYSTACK', 'FLUTTERWAVE', 'NIBSS'].includes(value));
    return [...new Set(configured)].filter((provider) => this.providerAvailable(provider));
  }

  async nameEnquiry(bankCode: string, accountNumber: string, providerHint?: string) {
    const normalizedBankCode = String(bankCode || '').trim();
    const normalizedAccountNumber = String(accountNumber || '').replace(/\D/g, '');
    if (!normalizedBankCode) throw new BadRequestException('Bank code is required');
    if (!/^\d{10}$/.test(normalizedAccountNumber)) throw new BadRequestException('Enter a valid 10-digit account number');

    const providers = this.providerOrder(providerHint);
    if (!providers.length) {
      throw new ServiceUnavailableException('Bank account verification is not configured. Configure Paystack, Flutterwave, or NIBSS credentials on the PWFB backend.');
    }
    let lastError: unknown;
    for (const provider of providers) {
      try {
        let payload: any;
        if (provider === 'PAYSTACK') {
          const base = (process.env.PAYSTACK_BASE_URL?.trim() || 'https://api.paystack.co').replace(/\/$/, '');
          const url = new URL(`${base}/bank/resolve`);
          url.searchParams.set('account_number', normalizedAccountNumber);
          url.searchParams.set('bank_code', normalizedBankCode);
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!.trim()}`, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          payload = await response.json().catch(() => null);
          if (!response.ok || payload?.status !== true) throw new ServiceUnavailableException(payload?.message || `Paystack account verification failed with status ${response.status}`);
          payload = payload.data;
        } else if (provider === 'FLUTTERWAVE') {
          const configuredBase = (process.env.FLUTTERWAVE_API_BASE_URL?.trim() || 'https://api.flutterwave.com/v3').replace(/\/$/, '');
          const base = configuredBase.endsWith('/v3') ? configuredBase : `${configuredBase}/v3`;
          const response = await fetch(`${base}/accounts/resolve`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${(process.env.FLUTTERWAVE_SECRET_KEY || process.env.FLW_SECRET_KEY)!.trim()}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ account_number: normalizedAccountNumber, account_bank: normalizedBankCode }),
            signal: AbortSignal.timeout(10000),
          });
          payload = await response.json().catch(() => null);
          if (!response.ok || String(payload?.status || '').toLowerCase() !== 'success') throw new ServiceUnavailableException(payload?.message || `Flutterwave account verification failed with status ${response.status}`);
          payload = payload.data;
        } else {
          payload = await this.nibssService.nameEnquiry(normalizedBankCode, normalizedAccountNumber);
        }

        const returnedAccountNumber = String(payload?.account_number ?? payload?.accountNumber ?? normalizedAccountNumber).replace(/\D/g, '');
        const accountName = String(payload?.account_name ?? payload?.accountName ?? payload?.name ?? '').trim();
        if (returnedAccountNumber !== normalizedAccountNumber) {
          throw new BadRequestException('The verification provider returned a different account number. Please check the number and try again.');
        }
        if (!accountName) throw new BadRequestException('The bank did not return a verified account name.');
        return { accountNumber: returnedAccountNumber, accountName, provider };
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new ServiceUnavailableException('Unable to verify this bank account with the configured providers.');
  }

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

    const xref = `NIP-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const providerResult = await this.nibssService.transfer({
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
      const updated = await tx.customerWallet.updateMany({ where: { id: currentWallet.id, status: 'ACTIVE', balance: { gte: amount } }, data: { balance: newBalance } });
      if (updated.count !== 1) throw new BadRequestException('Transfer could not be completed because the wallet balance changed');
      const transaction = await tx.walletTransaction.create({
        data: {
          customerId: input.customerId,
          type: 'WITHDRAWAL',
          amount,
          previousBalance: currentWallet.balance,
          newBalance,
          reference: xref,
          description: input.description || `Bank transfer to ${accountName}`,
          provider: 'NIBSS',
          providerReference: String((providerResult as any)?.providerReference ?? (providerResult as any)?.transactionReference ?? xref),
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });
      return { wallet: { ...currentWallet, balance: newBalance }, transaction, provider: providerResult };
    });
  }
}
