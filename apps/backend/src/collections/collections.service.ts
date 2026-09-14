import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    periodId: string;
    branchId: string;
    staffId: string;
    customerId: string;
    type: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER';
    amount: number;
    reference?: string;
    notes?: string;
    collectionDate?: string;
  }) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot add collections to a closed period');

    const branch = await this.prisma.branch.findUnique({ where: { id: data.branchId } });
    if (!branch) throw new NotFoundException('Branch not found');
    const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId } });
    if (!staff) throw new NotFoundException('Collector/staff not found');
    const customer = await this.prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Collection amount must be greater than zero');

    return this.prisma.dailyCollection.create({
      data: {
        periodId: data.periodId,
        branchId: data.branchId,
        staffId: data.staffId,
        customerId: data.customerId,
        type: data.type,
        amount,
        reference: data.reference,
        notes: data.notes,
        collectionDate: data.collectionDate ? new Date(data.collectionDate) : new Date(),
      },
      include: { period: true, branch: true, staff: true, customer: true },
    });
  }

  async findAll(periodId?: string, branchId?: string, staffId?: string, type?: 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER') {
    return this.prisma.dailyCollection.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(staffId ? { staffId } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { collectionDate: 'desc' },
      include: { period: true, branch: true, staff: true, customer: true },
    });
  }

  async findOne(id: string) {
    const collection = await this.prisma.dailyCollection.findUnique({
      where: { id },
      include: { period: true, branch: true, staff: true, customer: true },
    });
    if (!collection) throw new NotFoundException('Daily collection not found');
    return collection;
  }

  async settle(id: string, targetId?: string) {
    const collection = await this.findOne(id);
    if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period');
    if (collection.settled) throw new BadRequestException('Collection has already been settled');

    const amount = Number(collection.amount);
    const reference = collection.reference || `COL-${collection.id}`;
    const description = `Field collection ${reference} — ${collection.type}`;

    return this.prisma.$transaction(async (tx) => {
      let transactionId: string;
      let recordId: string | undefined;

      if (collection.type === 'SAVINGS') {
        if (!targetId) throw new BadRequestException('A savings account is required to settle a savings collection');
        const savings = await tx.savings.findUnique({ where: { id: targetId } });
        if (!savings) throw new NotFoundException('Savings account not found');
        if (savings.customerId !== collection.customerId) throw new BadRequestException('Savings account does not belong to the collection customer');

        await tx.savings.update({ where: { id: savings.id }, data: { amount: { increment: amount } } });
        const transaction = await tx.transaction.create({
          data: {
            customerId: collection.customerId,
            type: 'DEPOSIT',
            amount,
            description,
            periodId: collection.periodId,
          },
        });
        transactionId = transaction.id;
      } else if (collection.type === 'LOAN_REPAYMENT') {
        if (!targetId) throw new BadRequestException('A loan is required to settle a loan repayment collection');
        const loan = await tx.loan.findUnique({ where: { id: targetId } });
        if (!loan) throw new NotFoundException('Loan not found');
        if (loan.customerId !== collection.customerId) throw new BadRequestException('Loan does not belong to the collection customer');

        const repayment = await tx.repayment.create({
          data: {
            loanId: loan.id,
            amount,
            paymentDate: collection.collectionDate,
            method: 'FIELD_COLLECTION',
            notes: collection.notes || description,
            periodId: collection.periodId,
          },
        });
        recordId = repayment.id;

        const transaction = await tx.transaction.create({
          data: {
            customerId: collection.customerId,
            type: 'LOAN_REPAYMENT',
            amount,
            description,
            periodId: collection.periodId,
          },
        });
        transactionId = transaction.id;
      } else {
        const transaction = await tx.transaction.create({
          data: {
            customerId: collection.customerId,
            type: 'COLLECTION_OTHER',
            amount,
            description,
            periodId: collection.periodId,
          },
        });
        transactionId = transaction.id;
      }

      await tx.cashbookEntry.create({
        data: {
          periodId: collection.periodId,
          branchId: collection.branchId,
          type: 'CASH_IN',
          amount,
          reference,
          description,
          entryDate: collection.collectionDate,
        },
      });

      return tx.dailyCollection.update({
        where: { id },
        data: {
          settled: true,
          settledAt: new Date(),
          settlementTransactionId: transactionId,
          settlementRecordId: recordId,
          reconciled: true,
        },
        include: { period: true, branch: true, staff: true, customer: true },
      });
    });
  }

  async summary(periodId?: string, branchId?: string, staffId?: string) {
    const collections = await this.prisma.dailyCollection.findMany({
      where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}), ...(staffId ? { staffId } : {}) },
    });
    const result = collections.reduce((summary, collection) => {
      summary.total += collection.amount;
      if (collection.type === 'SAVINGS') summary.savings += collection.amount;
      if (collection.type === 'LOAN_REPAYMENT') summary.loanRepayments += collection.amount;
      if (collection.type === 'OTHER') summary.other += collection.amount;
      if (collection.reconciled) summary.reconciled += collection.amount;
      else summary.unreconciled += collection.amount;
      if (collection.settled) summary.settled += collection.amount;
      else summary.unsettled += collection.amount;
      summary.collectionCount++;
      return summary;
    }, { total: 0, savings: 0, loanRepayments: 0, other: 0, reconciled: 0, unreconciled: 0, settled: 0, unsettled: 0, collectionCount: 0 });
    return result;
  }

  async reconcile(id: string) {
    const collection = await this.findOne(id);
    if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period');
    return this.prisma.dailyCollection.update({ where: { id }, data: { reconciled: true }, include: { period: true, branch: true, staff: true, customer: true } });
  }

  async unreconcile(id: string) {
    const collection = await this.findOne(id);
    if (collection.period.status === 'CLOSED') throw new BadRequestException('Collection belongs to a closed period');
    if (collection.settled) throw new BadRequestException('A settled collection cannot be unreconciled');
    return this.prisma.dailyCollection.update({ where: { id }, data: { reconciled: false } });
  }

  async dailySummary(date: string, branchId?: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid collection date');
    const collections = await this.prisma.dailyCollection.findMany({ where: { collectionDate: { gte: start, lte: end }, ...(branchId ? { branchId } : {}) } });
    return collections.reduce((summary, collection) => {
      summary.total += collection.amount;
      if (collection.type === 'SAVINGS') summary.savings += collection.amount;
      if (collection.type === 'LOAN_REPAYMENT') summary.loanRepayments += collection.amount;
      if (collection.type === 'OTHER') summary.other += collection.amount;
      if (collection.settled) summary.settled += collection.amount;
      else summary.unsettled += collection.amount;
      summary.collectionCount++;
      return summary;
    }, { date, total: 0, savings: 0, loanRepayments: 0, other: 0, settled: 0, unsettled: 0, collectionCount: 0 });
  }
}
