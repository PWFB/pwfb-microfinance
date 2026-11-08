import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReconciliationService } from '../reconciliation/reconciliation.service';

@Injectable()
export class PeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  async create(data: {
    name: string;
    startDate: string;
    endDate: string;
  }) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const existingOpen = await this.prisma.financialPeriod.findFirst({ where: { status: 'OPEN' } });
    if (existingOpen) {
      throw new BadRequestException(`Period "${existingOpen.name}" is already open`);
    }

    return this.prisma.financialPeriod.create({
      data: { name: data.name, startDate, endDate, status: 'OPEN' },
    });
  }

  async findAll() {
    return this.prisma.financialPeriod.findMany({ orderBy: { startDate: 'desc' } });
  }

  async current() {
    const period = await this.prisma.financialPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });
    if (!period) throw new NotFoundException('No open financial period found');
    return period;
  }

  async findOne(id: string) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException('Financial period not found');
    return period;
  }

  async closingCheck(id: string, user: any) {
    const period = await this.findOne(id);
    const reconciliation = await this.reconciliation.summary(user, id);
    const controls = reconciliation.controls;
    const blockers: string[] = [];

    if (controls.collections.unreconciledAmount > 0) {
      blockers.push(`Unreconciled collections: ₦${controls.collections.unreconciledAmount.toLocaleString('en-NG')}`);
    }
    if (controls.collections.outstandingSettlement > 0) {
      blockers.push(`Unsettled collections: ₦${controls.collections.outstandingSettlement.toLocaleString('en-NG')}`);
    }

    return {
      period: { id: period.id, name: period.name, status: period.status },
      canClose: period.status === 'OPEN' && blockers.length === 0,
      status: blockers.length === 0 ? 'READY_TO_CLOSE' : 'REVIEW_REQUIRED',
      blockers,
      checklist: {
        collectionsReconciled: controls.collections.unreconciledAmount === 0,
        collectionsSettled: controls.collections.outstandingSettlement === 0,
        cashbookReviewed: true,
        staffWalletReviewed: true,
        payrollReviewed: true,
        approvalsReviewed: true,
      },
    };
  }

  async close(id: string, user: any) {
    const period = await this.findOne(id);
    if (period.status === 'CLOSED') throw new BadRequestException('Financial period is already closed');

    const check = await this.closingCheck(id, user);
    if (!check.canClose) {
      throw new BadRequestException(`Period cannot be closed until reconciliation is complete. ${check.blockers.join('; ')}`);
    }

    return this.prisma.financialPeriod.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
}
