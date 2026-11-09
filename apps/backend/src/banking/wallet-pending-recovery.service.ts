import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaystackService } from './paystack.service';
import { FlutterwaveService } from './flutterwave.service';
import { WalletWithdrawalWebhookService } from './wallet-withdrawal-webhook.service';
import { CustomerVirtualAccountService } from './customer-virtual-account.service';
import { PaystackBranchDvaService } from './paystack-branch-dva.service';

type PendingWalletTransaction = {
  id: string;
  type: string;
  status: string;
  provider: string | null;
  reference: string;
  providerReference: string | null;
  amount: number;
};

@Injectable()
export class WalletPendingRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletPendingRecoveryService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly intervalMs = 60_000;
  private readonly minimumPendingAgeMs = 5 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly paystack: PaystackService,
    private readonly flutterwave: FlutterwaveService,
    private readonly withdrawalWebhook: WalletWithdrawalWebhookService,
    private readonly customerVirtualAccounts: CustomerVirtualAccountService,
    private readonly branchDva: PaystackBranchDvaService,
  ) {}

  onModuleInit() {
    // Start one recovery pass after the application has finished booting.
    void this.recoverPendingTransactions().catch((error) => this.logger.warn(`Initial recovery pass failed: ${error instanceof Error ? error.message : 'database query failed'}`));
    this.timer = setInterval(() => {
      void this.recoverPendingTransactions().catch((error) => this.logger.warn(`Scheduled recovery pass failed: ${error instanceof Error ? error.message : 'database query failed'}`));
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async recoverPendingTransactions() {
    if (this.running) return { ok: true, skipped: true, reason: 'recovery-already-running', checked: 0, completed: 0, failed: 0, reversed: 0, stillPending: 0, errors: 0 };
    this.running = true;
    const summary = {
      checked: 0, completed: 0, failed: 0, reversed: 0, stillPending: 0, errors: 0,
      dvaAccountsChecked: 0, dvaRequeries: 0, dvaRequeryErrors: 0,
      branchDvaAccountsChecked: 0, branchDvaRequeries: 0, branchDvaRequeryErrors: 0,
    };
    try {
      try {
        const requery = await this.customerVirtualAccounts.requeryDuePaystackAccounts(50);
        summary.dvaAccountsChecked = Number(requery?.checked || 0);
        summary.dvaRequeries = Number(requery?.requested || 0);
        summary.dvaRequeryErrors = Number(requery?.errors || 0);
      } catch (error) {
        summary.dvaRequeryErrors += 1;
        this.logger.warn(
          `Paystack DVA requery deferred: ${error instanceof Error ? error.message : 'provider request failed'}`,
        );
      }

      try {
        const requery = await this.branchDva.requeryDueAccounts(50);
        summary.branchDvaAccountsChecked = Number(requery?.checked || 0);
        summary.branchDvaRequeries = Number(requery?.requested || 0);
        summary.branchDvaRequeryErrors = Number(requery?.errors || 0);
      } catch (error) {
        summary.branchDvaRequeryErrors += 1;
        this.logger.warn(
          `Paystack branch DVA requery deferred: ${error instanceof Error ? error.message : 'provider request failed'}`,
        );
      }

      const cutoff = new Date(Date.now() - this.minimumPendingAgeMs);
      const transactions = await this.prisma.walletTransaction.findMany({
        where: {
          type: { in: ['DEPOSIT', 'WITHDRAWAL'] },
          status: { in: ['PENDING', 'PROCESSING'] },
          createdAt: { lt: cutoff },
          provider: { in: ['PAYSTACK', 'FLUTTERWAVE'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: {
          id: true, type: true, status: true, provider: true,
          reference: true, providerReference: true, amount: true,
        },
      }) as PendingWalletTransaction[];

      for (const transaction of transactions) {
        summary.checked += 1;
        try {
          const outcome = await this.reconcileOne(transaction);
          if (outcome === 'COMPLETED') summary.completed += 1;
          else if (outcome === 'FAILED') summary.failed += 1;
          else if (outcome === 'REVERSED') summary.reversed += 1;
          else summary.stillPending += 1;
        } catch (error) {
          summary.errors += 1;
          this.logger.warn(
            `Pending transaction reconciliation deferred for ${transaction.reference}: ${error instanceof Error ? error.message : 'provider check failed'}`,
          );
        }
      }
      return { ok: true, ...summary };
    } finally {
      this.running = false;
    }
  }

  private async reconcileOne(transaction: PendingWalletTransaction): Promise<string> {
    const provider = String(transaction.provider || '').toUpperCase();
    if (provider === 'PAYSTACK' && transaction.type === 'DEPOSIT') {
      const reference = transaction.reference.startsWith('PAY-')
        ? transaction.reference.slice(4)
        : transaction.providerReference || transaction.reference;
      const verified = await this.paystack.getTransactionVerification(reference);
      if (!verified || String(verified.reference || '') !== reference) return 'PENDING';
      const status = String(verified.status || '').toLowerCase();
      if (status === 'success') {
        const result = await this.paystack.handleWebhook({ event: 'charge.success', data: verified });
        return result?.processed || result?.duplicate ? 'COMPLETED' : 'PENDING';
      }
      if (['failed', 'abandoned', 'reversed'].includes(status)) {
        const terminal = status === 'reversed' ? 'REVERSED' : 'FAILED';
        await this.paystack.reconcilePendingDeposit(
          reference,
          terminal,
          String(verified.gateway_response || verified.message || `Paystack verified deposit status: ${status}`),
        );
        return terminal;
      }
      return 'PENDING';
    }

    if (provider === 'PAYSTACK' && transaction.type === 'WITHDRAWAL') {
      // Paystack's verification API takes the same reference used to initiate
      // the transfer, not the numeric provider transfer ID.
      const verified = await this.paystack.getTransferVerification(transaction.reference);
      if (!verified || String(verified.reference || '') !== transaction.reference) return 'PENDING';
      const status = String(verified.status || '').toLowerCase();
      if (String(verified.currency || '').toUpperCase() !== 'NGN' ||
          Math.round(Number(verified.amount)) !== Math.round(Number(transaction.amount) * 100)) return 'PENDING';
      const event = status === 'success'
        ? 'transfer.success'
        : status === 'failed'
          ? 'transfer.failed'
          : status === 'reversed'
            ? 'transfer.reversed'
            : '';
      if (!event) return 'PENDING';
      const result = await this.paystack.handleWebhook({ event, data: verified });
      if (result?.conflict) return 'PENDING';
      if (event === 'transfer.success') return 'COMPLETED';
      if (event === 'transfer.reversed') return 'REVERSED';
      return 'FAILED';
    }

    if (provider === 'FLUTTERWAVE' && transaction.type === 'WITHDRAWAL') {
      const lookup = String(transaction.providerReference || transaction.reference);
      const verified = await this.flutterwave.getTransferStatus(lookup);
      const data = verified?.data ?? {};
      if (!data || String(data.reference || '') !== transaction.reference) return 'PENDING';
      const status = String(data.status || '').toUpperCase();
      if (String(data.currency || '').toUpperCase() !== 'NGN' ||
          Math.round(Number(data.amount) * 100) !== Math.round(Number(transaction.amount) * 100)) return 'PENDING';
      if (status === 'SUCCESSFUL' || status === 'COMPLETED') {
        const result = await this.withdrawalWebhook.applyVerifiedReconciliation({
          transactionReference: transaction.reference,
          status: 'COMPLETED',
          provider: 'FLUTTERWAVE',
          providerReference: String(data.id ?? lookup),
        });
        if (result?.action === 'COMPLETED') return 'COMPLETED';
        if (result?.duplicate && result?.transaction?.status === 'COMPLETED') return 'COMPLETED';
        return 'PENDING';
      }
      if (status === 'FAILED') {
        const result = await this.withdrawalWebhook.applyVerifiedReconciliation({
          transactionReference: transaction.reference,
          status: 'FAILED',
          provider: 'FLUTTERWAVE',
          providerReference: String(data.id ?? lookup),
          failureReason: String(data.complete_message || data.processor_response || 'Flutterwave verified transfer failure'),
        });
        if (result?.action === 'REFUNDED') return 'FAILED';
        if (result?.duplicate && result?.transaction?.status === 'COMPLETED') return 'COMPLETED';
        if (result?.duplicate && result?.transaction?.status === 'FAILED') return 'FAILED';
        return 'PENDING';
      }
    }

    // We deliberately do not auto-refund NIBSS or provider-less operations.
    // No authoritative status endpoint for those paths has been integrated.
    return 'PENDING';
  }
}
