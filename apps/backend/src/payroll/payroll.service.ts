import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    periodId: string;
    branchId?: string;
  }) {
    const period = await this.prisma.financialPeriod.findUnique({
      where: { id: data.periodId },
    });

    if (!period) {
      throw new NotFoundException('Financial period not found');
    }

    if (period.status === 'CLOSED') {
      throw new BadRequestException(
        'Cannot create payroll for a closed period',
      );
    }

    return this.prisma.payroll.create({
      data: {
        periodId: data.periodId,
        branchId: data.branchId,
        status: 'DRAFT',
      },
      include: {
        items: true,
        period: true,
        branch: true,
      },
    });
  }

  async findAll() {
    return this.prisma.payroll.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        period: true,
        branch: true,
        items: {
          include: {
            staff: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        period: true,
        branch: true,
        items: {
          include: {
            staff: true,
          },
        },
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    return payroll;
  }

  async addItem(
    payrollId: string,
    data: {
      staffId: string;
      basicSalary?: number;
      allowances?: number;
      deductions?: number;
    },
  ) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft payroll can be edited',
      );
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: data.staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    const basicSalary = Number(data.basicSalary ?? 0);
    const allowances = Number(data.allowances ?? 0);
    const deductions = Number(data.deductions ?? 0);

    if (
      basicSalary < 0 ||
      allowances < 0 ||
      deductions < 0
    ) {
      throw new BadRequestException(
        'Payroll amounts cannot be negative',
      );
    }

    const netSalary =
      basicSalary + allowances - deductions;

    const item = await this.prisma.payrollItem.upsert({
      where: {
        payrollId_staffId: {
          payrollId,
          staffId: data.staffId,
        },
      },
      update: {
        basicSalary,
        allowances,
        deductions,
        netSalary,
      },
      create: {
        payrollId,
        staffId: data.staffId,
        basicSalary,
        allowances,
        deductions,
        netSalary,
      },
    });

    await this.recalculate(payrollId);

    return item;
  }

  private async recalculate(payrollId: string) {
    const items = await this.prisma.payrollItem.findMany({
      where: { payrollId },
    });

    const totals = items.reduce(
      (result, item) => {
        result.totalBasic += item.basicSalary;
        result.totalAllowances += item.allowances;
        result.totalDeductions += item.deductions;
        result.totalNet += item.netSalary;

        return result;
      },
      {
        totalBasic: 0,
        totalAllowances: 0,
        totalDeductions: 0,
        totalNet: 0,
      },
    );

    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: totals,
    });
  }

  async approve(id: string) {
    const payroll = await this.findOne(id);

    if (payroll.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft payroll can be approved',
      );
    }

    if (payroll.items.length === 0) {
      throw new BadRequestException(
        'Payroll must contain at least one staff item',
      );
    }

    return this.prisma.payroll.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: {
        items: true,
        period: true,
        branch: true,
      },
    });
  }

  async markPaid(id: string) {
    const payroll = await this.findOne(id);

    if (payroll.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only approved payroll can be marked as paid',
      );
    }

    return this.prisma.payroll.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentDate: new Date(),
      },
      include: {
        items: true,
        period: true,
        branch: true,
      },
    });
  }

  async summary(periodId?: string, branchId?: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(branchId ? { branchId } : {}),
      },
    });

    return payrolls.reduce(
      (result, payroll) => {
        result.payrollCount++;
        result.totalBasic += payroll.totalBasic;
        result.totalAllowances += payroll.totalAllowances;
        result.totalDeductions += payroll.totalDeductions;
        result.totalNet += payroll.totalNet;

        return result;
      },
      {
        payrollCount: 0,
        totalBasic: 0,
        totalAllowances: 0,
        totalDeductions: 0,
        totalNet: 0,
      },
    );
  }
}
