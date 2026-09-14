import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { periodId: string; branchId?: string }) {
    const period = await this.prisma.financialPeriod.findUnique({ where: { id: data.periodId } });
    if (!period) throw new NotFoundException('Financial period not found');
    if (period.status === 'CLOSED') throw new BadRequestException('Cannot create payroll for a closed period');
    const staff = await this.prisma.staff.findMany({ where: { employmentStatus: 'ACTIVE', ...(data.branchId ? { branchId: data.branchId } : {}) }, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }] });
    return this.prisma.payroll.create({ data: { periodId: data.periodId, branchId: data.branchId, status: 'DRAFT', items: { create: staff.map((member) => ({ staffId: member.id, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0 })) } }, include: { items: { include: { staff: true } }, period: true, branch: true } });
  }

  async findAll() { return this.prisma.payroll.findMany({ orderBy: { createdAt: 'desc' }, include: { period: true, branch: true, items: { include: { staff: true } } } }); }
  async findOne(id: string) { const payroll = await this.prisma.payroll.findUnique({ where: { id }, include: { period: true, branch: true, items: { include: { staff: true } } } }); if (!payroll) throw new NotFoundException('Payroll not found'); return payroll; }

  async headOfficeBalance() {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ balance: number }>>(`SELECT balance FROM head_office_accounts WHERE id = 'HEAD_OFFICE' LIMIT 1`);
    return { account: 'Head Office Account', balance: Number(rows[0]?.balance ?? 0), currency: 'NGN' };
  }

  async addItem(payrollId: string, data: { staffId: string; basicSalary?: number; allowances?: number; deductions?: number }) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id: payrollId } });
    if (!payroll) throw new NotFoundException('Payroll not found');
    if (payroll.status !== 'DRAFT') throw new BadRequestException('Only draft payroll can be edited');
    const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    const basicSalary = Number(data.basicSalary ?? 0), allowances = Number(data.allowances ?? 0), deductions = Number(data.deductions ?? 0);
    if (basicSalary < 0 || allowances < 0 || deductions < 0) throw new BadRequestException('Payroll amounts cannot be negative');
    const netSalary = basicSalary + allowances - deductions;
    const item = await this.prisma.payrollItem.upsert({ where: { payrollId_staffId: { payrollId, staffId: data.staffId } }, update: { basicSalary, allowances, deductions, netSalary }, create: { payrollId, staffId: data.staffId, basicSalary, allowances, deductions, netSalary } });
    await this.recalculate(payrollId);
    return item;
  }

  private async recalculate(payrollId: string) {
    const items = await this.prisma.payrollItem.findMany({ where: { payrollId } });
    const totals = items.reduce((result, item) => { result.totalBasic += item.basicSalary; result.totalAllowances += item.allowances; result.totalDeductions += item.deductions; result.totalNet += item.netSalary; return result; }, { totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNet: 0 });
    return this.prisma.payroll.update({ where: { id: payrollId }, data: totals });
  }

  async approve(id: string) { const payroll = await this.findOne(id); if (payroll.status !== 'DRAFT') throw new BadRequestException('Only draft payroll can be approved'); if (payroll.items.length === 0) throw new BadRequestException('Payroll must contain at least one staff item'); if (payroll.totalNet <= 0) throw new BadRequestException('Payroll total net salary must be greater than zero'); return this.prisma.payroll.update({ where: { id }, data: { status: 'APPROVED' }, include: { items: true, period: true, branch: true } }); }

  async markPaid(id: string) {
    const payroll = await this.findOne(id);
    if (payroll.status !== 'APPROVED') throw new BadRequestException('Only approved payroll can be paid');
    const amount = Number(payroll.totalNet);
    if (amount <= 0) throw new BadRequestException('Payroll total net salary must be greater than zero');
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ balance: number }>>(`SELECT balance FROM head_office_accounts WHERE id = 'HEAD_OFFICE' FOR UPDATE`);
      const balance = Number(rows[0]?.balance ?? 0);
      if (balance < amount) throw new BadRequestException(`Insufficient Head Office Account balance. Available ₦${balance.toLocaleString('en-NG')}, required ₦${amount.toLocaleString('en-NG')}.`);
      const newBalance = balance - amount;
      await tx.$executeRawUnsafe(`UPDATE head_office_accounts SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 'HEAD_OFFICE'`, newBalance);
      await tx.$executeRawUnsafe(`INSERT INTO head_office_account_transactions (id, account_id, type, amount, previous_balance, new_balance, reference, description, payroll_id) VALUES ($1, 'HEAD_OFFICE', 'SALARY_PAYMENT', $2, $3, $4, $5, $6, $7)`, `HOPAY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, amount, balance, newBalance, `PAYROLL-${id}`, `Salary payment for payroll ${id}`, id);
      return tx.payroll.update({ where: { id }, data: { status: 'PAID', paymentDate: new Date() }, include: { items: { include: { staff: true } }, period: true, branch: true } });
    });
  }

  async summary(periodId?: string, branchId?: string) { const payrolls = await this.prisma.payroll.findMany({ where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}) } }); return payrolls.reduce((result, payroll) => { result.payrollCount++; result.totalBasic += payroll.totalBasic; result.totalAllowances += payroll.totalAllowances; result.totalDeductions += payroll.totalDeductions; result.totalNet += payroll.totalNet; return result; }, { payrollCount: 0, totalBasic: 0, totalAllowances: 0, totalDeductions: 0, totalNet: 0 }); }
}
