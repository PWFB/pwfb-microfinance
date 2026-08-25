import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from '../access/staff-scope.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService, private readonly scope: StaffScopeService) {}

  async create(dto: CreateTransactionDto, authUser: any) {
    await this.scope.assertCustomerAccess(authUser, dto.customerId);
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.transaction.create({ data: { customerId: dto.customerId, type: dto.type, amount: dto.amount, description: dto.description }, include: { customer: true } });
  }

  async findAll(authUser: any) {
    const customerWhere = await this.scope.customerWhere(authUser);
    const [ledgerTransactions, walletTransactions] = await Promise.all([
      this.prisma.transaction.findMany({ where: { customer: customerWhere } as any, orderBy: { createdAt: 'desc' }, include: { customer: true } }),
      this.prisma.walletTransaction.findMany({ where: { customer: customerWhere } as any, orderBy: { createdAt: 'desc' }, include: { customer: true } }),
    ]);
    const legacy = ledgerTransactions.map(t => ({ ...t, source: 'LEDGER', status: 'COMPLETED', provider: null, providerReference: null, processedAt: t.createdAt, walletBalanceBefore: null, walletBalanceAfter: null }));
    const wallet = walletTransactions.map(t => ({ id: t.id, customerId: t.customerId, customer: t.customer, type: t.type, amount: t.amount, description: t.description, periodId: null, createdAt: t.createdAt, updatedAt: t.createdAt, source: 'WALLET', status: t.status, provider: t.provider, providerReference: t.providerReference, reference: t.reference, processedAt: t.processedAt, walletBalanceBefore: t.previousBalance, walletBalanceAfter: t.newBalance, branchId: t.branchId, staffId: t.staffId, failureReason: t.failureReason }));
    return [...legacy, ...wallet].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async findOne(id: string, authUser: any) {
    const customerWhere = await this.scope.customerWhere(authUser);
    const walletTransaction = await this.prisma.walletTransaction.findFirst({ where: { id, customer: customerWhere } as any, include: { customer: true } });
    if (walletTransaction) return { id: walletTransaction.id, customerId: walletTransaction.customerId, customer: walletTransaction.customer, type: walletTransaction.type, amount: walletTransaction.amount, description: walletTransaction.description, createdAt: walletTransaction.createdAt, updatedAt: walletTransaction.createdAt, source: 'WALLET', status: walletTransaction.status, provider: walletTransaction.provider, providerReference: walletTransaction.providerReference, reference: walletTransaction.reference, processedAt: walletTransaction.processedAt, walletBalanceBefore: walletTransaction.previousBalance, walletBalanceAfter: walletTransaction.newBalance, branchId: walletTransaction.branchId, staffId: walletTransaction.staffId, failureReason: walletTransaction.failureReason };
    const transaction = await this.prisma.transaction.findFirst({ where: { id, customer: customerWhere } as any, include: { customer: true } });
    if (!transaction) throw new NotFoundException('Transaction not found or not accessible');
    return { ...transaction, source: 'LEDGER', status: 'COMPLETED', provider: null, providerReference: null, processedAt: transaction.createdAt, walletBalanceBefore: null, walletBalanceAfter: null };
  }

  async update(id: string, dto: UpdateTransactionDto, authUser: any) {
    const walletTransaction = await this.prisma.walletTransaction.findUnique({ where: { id }, select: { id: true } });
    if (walletTransaction) throw new BadRequestException('Wallet transactions are system-generated and cannot be edited from the ledger');
    await this.findOne(id, authUser);
    if (dto.customerId) await this.scope.assertCustomerAccess(authUser, dto.customerId);
    return this.prisma.transaction.update({ where: { id }, data: { customerId: dto.customerId, type: dto.type, amount: dto.amount, description: dto.description }, include: { customer: true } });
  }

  async remove(id: string, authUser: any) { const walletTransaction = await this.prisma.walletTransaction.findUnique({ where: { id }, select: { id: true } }); if (walletTransaction) throw new BadRequestException('Wallet transactions are system-generated and cannot be deleted from the ledger'); await this.findOne(id, authUser); return this.prisma.transaction.delete({ where: { id } }); }
}
