import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from '../access/staff-scope.service';

type CollectionType = 'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER';
type PaymentMethod = 'CASH' | 'DEPOSIT';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: StaffScopeService,
  ) {}

  async create(
    data: {
      periodId?: string;
      branchId?: string;
      staffId?: string;
      customerId: string;
      type: CollectionType;
      amount: number;
      paymentMethod?: PaymentMethod;
      reference?: string;
      notes?: string;
      collectionDate?: string;
    },
    authUser: any,
  ) {
    const access = await this.scope.get(authUser);

    if (!access.global) {
      await this.scope.assertCustomerAccess(authUser, data.customerId);
    }

    const staff = access.global
      ? (data.staffId
          ? await this.prisma.staff.findUnique({ where: { id: data.staffId } })
          : null)
      : await this.prisma.staff.findUnique({ where: { id: access.staff.id } });

    if (!staff) {
      throw new NotFoundException('Collector/staff not found');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { id: true, branchId: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (!access.global && customer.branchId !== staff.branchId) {
      throw new ForbiddenException('Customer is outside your assigned branch');
    }

    const period = data.periodId
      ? await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } })
      : await this.prisma.financialPeriod.findFirst({
          where: { status: 'OPEN' },
          orderBy: { startDate: 'desc' },
        });

    if (!period) throw new NotFoundException('No open financial period found');
    if (period.status === 'CLOSED') {
      throw new BadRequestException('Cannot add collections to a closed period');
    }

    const branchId = access.global
      ? data.branchId || staff.branchId
      : staff.branchId;

    if (!branchId) throw new BadRequestException('Branch is required');

    await this.scope.assertBranchAccess(authUser, branchId);

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Collection amount must be greater than zero');
    }

    const paymentMethod = data.paymentMethod || 'CASH';
    const notes = [paymentMethod, data.notes?.trim()].filter(Boolean).join(' • ');

    return this.prisma.dailyCollection.create({
      data: {
        periodId: period.id,
        branchId,
        staffId: staff.id,
        customerId: data.customerId,
        type: data.type,
        amount,
        reference: data.reference,
        notes,
        collectionDate: data.collectionDate ? new Date(data.collectionDate) : new Date(),
      },
      include: {
        period: true,
        branch: true,
        staff: true,
        customer: true,
      },
    });
  }

  async findAll(
    periodId?: string,
    branchId?: string,
    staffId?: string,
    type?: CollectionType,
    authUser?: any,
  ) {
    const accessWhere = authUser ? await this.scope.collectionWhere(authUser) : {};
    const access = authUser ? await this.scope.get(authUser) : null;

    const requestedBranch = branchId ? { branchId } : {};
    const requestedStaff = staffId ? { staffId } : {};

    // Field staff cannot widen their view with query parameters.
    if (access && !access.global && ['CREDIT_OFFICER', 'COLLECTOR', 'STAFF'].includes(access.role)) {
      return this.prisma.dailyCollection.findMany({
        where: {
          ...accessWhere,
          ...(periodId ? { periodId } : {}),
          ...(type ? { type } : {}),
        } as any,
        orderBy: { collectionDate: 'desc' },
        include: { period: true, branch: true, staff: true, customer: true },
      });
    }

    if (access && !access.global && branchId) {
      await this.scope.assertBranchAccess(authUser, branchId);
    }

    return this.prisma.dailyCollection.findMany({
      where: {
        ...accessWhere,
        ...(periodId ? { periodId } : {}),
        ...requestedBranch,
        ...requestedStaff,
        ...(type ? { type } : {}),
      } as any,
      orderBy: { collectionDate: 'desc' },
      include: { period: true, branch: true, staff: true, customer: true },
    });
  }

  async findOne(id: string, authUser: any) {
    const collection = await this.prisma.dailyCollection.findFirst({
      where: { id, ...(await this.scope.collectionWhere(authUser)) } as any,
      include: { period: true, branch: true, staff: true, customer: true },
    });

    if (!collection) {
      throw new NotFoundException('Daily collection not found or not accessible');
    }

    return collection;
  }

  async summary(
    periodId?: string,
    branchId?: string,
    staffId?: string,
    authUser?: any,
  ) {
    const accessWhere = authUser ? await this.scope.collectionWhere(authUser) : {};
    const access = authUser ? await this.scope.get(authUser) : null;

    if (access && !access.global && branchId) {
      await this.scope.assertBranchAccess(authUser, branchId);
    }

    const collections = await this.prisma.dailyCollection.findMany({
      where: {
        ...accessWhere,
        ...(periodId ? { periodId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(staffId ? { staffId } : {}),
      } as any,
    });

    return this.reduceSummary(collections);
  }

  async reconcile(id: string, authUser: any) {
    const collection = await this.findOne(id, authUser);
    if (collection.period.status === 'CLOSED') {
      throw new BadRequestException('Collection belongs to a closed period');
    }

    return this.prisma.dailyCollection.update({
      where: { id },
      data: { reconciled: true },
      include: { period: true, branch: true, staff: true, customer: true },
    });
  }

  async unreconcile(id: string, authUser: any) {
    const collection = await this.findOne(id, authUser);
    if (collection.period.status === 'CLOSED') {
      throw new BadRequestException('Collection belongs to a closed period');
    }

    return this.prisma.dailyCollection.update({
      where: { id },
      data: { reconciled: false },
    });
  }

  async dailySummary(date: string, branchId?: string, authUser?: any) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Invalid collection date');
    }

    if (authUser && branchId) await this.scope.assertBranchAccess(authUser, branchId);

    const accessWhere = authUser ? await this.scope.collectionWhere(authUser) : {};
    const collections = await this.prisma.dailyCollection.findMany({
      where: {
        ...accessWhere,
        collectionDate: { gte: start, lte: end },
        ...(branchId ? { branchId } : {}),
      } as any,
    });

    return {
      date,
      ...this.reduceSummary(collections),
    };
  }

  private reduceSummary(collections: Array<{ amount: number; type: CollectionType; reconciled?: boolean }>) {
    return collections.reduce(
      (summary, collection) => {
        summary.total += collection.amount;
        if (collection.type === 'SAVINGS') summary.savings += collection.amount;
        if (collection.type === 'LOAN_REPAYMENT') summary.loanRepayments += collection.amount;
        if (collection.type === 'OTHER') summary.other += collection.amount;
        if (collection.reconciled) summary.reconciled += collection.amount;
        else summary.unreconciled += collection.amount;
        summary.collectionCount++;
        return summary;
      },
      {
        total: 0,
        savings: 0,
        loanRepayments: 0,
        other: 0,
        reconciled: 0,
        unreconciled: 0,
        collectionCount: 0,
      },
    );
  }
}
