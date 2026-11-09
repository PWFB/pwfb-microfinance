import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { createFinancialReference } from '../common/financial-reference';

type TransactionUser = { id: string; role: string; staffId?: string };

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScope: AccessScopeService,
  ) {}

  private async scopedCustomerWhere(user: TransactionUser) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return null;

    const branchIds = await this.accessScope.getScopedBranchIds(user);
    if (!branchIds?.length) return { id: '__no_access__' };

    const where: any = { branchId: { in: branchIds } };
    if (['CREDIT_OFFICER','TELLER','LOAN_OFFICER','STAFF'].includes(scope.role)) {
      if (!scope.staffId) return { id: '__no_access__' };
      where.assignedStaffId = scope.staffId;
    }
    return where;
  }

  async create(createTransactionDto: CreateTransactionDto, user: TransactionUser) {
    await this.accessScope.assertCustomer(user, createTransactionDto.customerId);
    const customer = await this.prisma.customer.findUnique({
      where: { id: createTransactionDto.customerId },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.transaction.create({
      data: {
        customerId: createTransactionDto.customerId,
        reference: createFinancialReference('PWFB-TXN'),
        type: createTransactionDto.type,
        amount: createTransactionDto.amount,
        description: createTransactionDto.description,
      },
      include: { customer: true },
    });
  }

  async findAll(user: TransactionUser) {
    const customerWhere = await this.scopedCustomerWhere(user);
    const legacyWhere = customerWhere ? { customer: customerWhere } : {};
    const walletWhere: any = customerWhere
      ? {
          OR: [
            { branchId: { in: customerWhere.branchId?.in || [] }, customer: customerWhere },
            { branchId: null, customer: customerWhere },
          ],
        }
      : {};

    const [ledgerTransactions, walletTransactions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: legacyWhere as any,
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: walletWhere,
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
    ]);

    const legacy = ledgerTransactions.map((transaction) => ({
      ...transaction,
      source: 'LEDGER',
      status: 'COMPLETED',
      provider: null,
      providerReference: null,
      processedAt: transaction.createdAt,
      walletBalanceBefore: null,
      walletBalanceAfter: null,
    }));

    const wallet = walletTransactions.map((transaction) => ({
      id: transaction.id,
      customerId: transaction.customerId,
      customer: transaction.customer,
      type: transaction.type,
      amount: transaction.amount,
      description: transaction.description,
      periodId: null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.createdAt,
      source: 'WALLET',
      status: transaction.status,
      provider: transaction.provider,
      providerReference: transaction.providerReference,
      reference: transaction.reference,
      processedAt: transaction.processedAt,
      walletBalanceBefore: transaction.previousBalance,
      walletBalanceAfter: transaction.newBalance,
      branchId: transaction.branchId,
      staffId: transaction.staffId,
      failureReason: transaction.failureReason,
    }));

    return [...legacy, ...wallet].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private async loadOne(id: string) {
    const walletTransaction = await this.prisma.walletTransaction.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (walletTransaction) {
      return {
        id: walletTransaction.id,
        customerId: walletTransaction.customerId,
        customer: walletTransaction.customer,
        type: walletTransaction.type,
        amount: walletTransaction.amount,
        description: walletTransaction.description,
        createdAt: walletTransaction.createdAt,
        updatedAt: walletTransaction.createdAt,
        source: 'WALLET',
        status: walletTransaction.status,
        provider: walletTransaction.provider,
        providerReference: walletTransaction.providerReference,
        reference: walletTransaction.reference,
        processedAt: walletTransaction.processedAt,
        walletBalanceBefore: walletTransaction.previousBalance,
        walletBalanceAfter: walletTransaction.newBalance,
        branchId: walletTransaction.branchId,
        staffId: walletTransaction.staffId,
        failureReason: walletTransaction.failureReason,
      };
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!transaction) throw new NotFoundException('Transaction not found');

    return {
      ...transaction,
      source: 'LEDGER',
      status: 'COMPLETED',
      provider: null,
      providerReference: null,
      processedAt: transaction.createdAt,
      walletBalanceBefore: null,
      walletBalanceAfter: null,
    };
  }

  async findOne(id: string, user: TransactionUser) {
    await this.accessScope.assertTransaction(user, id);
    return this.loadOne(id);
  }

  async update(id: string, _updateTransactionDto: UpdateTransactionDto, user: TransactionUser) {
    const transaction = await this.findOne(id, user);

    if (transaction.source === 'WALLET') {
      throw new BadRequestException(
        'Wallet transactions are system-generated and cannot be edited from the ledger',
      );
    }

    throw new BadRequestException(
      'Ledger transactions are immutable. Create a correcting transaction or reversal instead of editing the original record.',
    );
  }

  async remove(id: string, user: TransactionUser) {
    const transaction = await this.findOne(id, user);

    if (transaction.source === 'WALLET') {
      throw new BadRequestException(
        'Wallet transactions are system-generated and cannot be deleted from the ledger',
      );
    }

    throw new BadRequestException(
      'Ledger transactions are immutable and cannot be deleted. Create a correcting transaction or reversal instead.',
    );
  }
}
