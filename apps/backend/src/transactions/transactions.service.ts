import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}

  private async customerWhere(user: any) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return {};
    const branchIds = await this.accessScope.getBranchIds(user);
    if (!branchIds?.length) return { id: { in: [] } };
    if (scope.role === 'CREDIT_OFFICER') {
      if (!scope.staffId) return { id: { in: [] } };
      return { branchId: { in: branchIds }, assignedStaffId: scope.staffId };
    }
    return { branchId: { in: branchIds } };
  }

  async create(createTransactionDto: CreateTransactionDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: createTransactionDto.customerId },
    });

    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.transaction.create({
      data: {
        customerId: createTransactionDto.customerId,
        type: createTransactionDto.type,
        amount: createTransactionDto.amount,
        description: createTransactionDto.description,
      },
      include: { customer: true },
    });
  }

  async findAll(user: any) {
    const customer = await this.customerWhere(user);
    const [ledgerTransactions, walletTransactions] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { customer },
        orderBy: { createdAt: 'desc' },
        include: { customer: true },
      }),
      this.prisma.walletTransaction.findMany({
        where: { customer },
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

  async findOne(id: string, user?: any) {
    const walletTransaction = await this.prisma.walletTransaction.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (walletTransaction) {
      if (user) await this.accessScope.assertCustomer(user, walletTransaction.customerId);
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
    if (user) await this.accessScope.assertCustomer(user, transaction.customerId);

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

  async update(id: string, _updateTransactionDto: UpdateTransactionDto) {
    const transaction = await this.findOne(id);

    if (transaction.source === 'WALLET') {
      throw new BadRequestException(
        'Wallet transactions are system-generated and cannot be edited from the ledger',
      );
    }

    throw new BadRequestException(
      'Ledger transactions are immutable. Create a correcting transaction or reversal instead of editing the original record.',
    );
  }

  async remove(id: string) {
    const transaction = await this.findOne(id);

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
