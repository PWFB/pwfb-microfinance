import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FinancialPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async payroll(periodId?: string, branchId?: string, query?: string) {
    const payrolls = await this.prisma.payroll.findMany({
      where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        period: true,
        branch: { include: { region: true } },
        items: { include: { staff: { include: { branch: { include: { region: true } } } } } },
      },
    });

    const q = query?.trim().toLowerCase();
    return payrolls.flatMap((p) => p.items
      .map((item) => ({
        id: item.id,
        payrollId: p.id,
        periodId: p.periodId,
        period: p.period.name,
        status: p.status,
        region: item.staff.branch?.region?.name ?? '',
        branch: item.staff.branch?.name ?? '',
        name: [item.staff.firstName, item.staff.middleName, item.staff.lastName].filter(Boolean).join(' '),
        staffId: item.staff.id,
        staffNumber: item.staff.staffId,
        gross: Number(item.basicSalary),
        allowances: Number(item.allowances),
        deductions: Number(item.deductions),
        netPay: Number(item.netSalary),
      }))
      .filter((row) => !q || Object.values(row).join(' ').toLowerCase().includes(q)));
  }

  async payrollSummary(periodId?: string, branchId?: string) {
    return this.prisma.payroll.aggregate({
      where: { ...(periodId ? { periodId } : {}), ...(branchId ? { branchId } : {}) },
      _count: { _all: true },
      _sum: { totalBasic: true, totalAllowances: true, totalDeductions: true, totalNet: true },
    });
  }

  async disbursements(batchReference?: string, status?: string) {
    return this.prisma.salaryDisbursement.findMany({
      where: { ...(batchReference ? { batchReference } : {}), ...(status ? { status } : {}) },
      orderBy: [{ scheduledDate: 'desc' }, { createdAt: 'desc' }],
      include: { staff: { include: { branch: true } }, payroll: true },
    });
  }

  async createDisbursement(data: {
    staffId: string; payrollId?: string; bankCode: string; bankName: string;
    accountNumber: string; accountName: string; amount: number; narration?: string;
    reference?: string; batchReference?: string; scheduledDate?: string;
  }) {
    const amount = Number(data.amount);
    if (!data.staffId || !data.bankCode || !data.bankName || !data.accountNumber || !data.accountName) {
      throw new BadRequestException('Staff, bank and account details are required');
    }
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Disbursement amount must be greater than zero');

    const staff = await this.prisma.staff.findUnique({ where: { id: data.staffId } });
    if (!staff) throw new BadRequestException('Staff member not found');

    return this.prisma.salaryDisbursement.create({
      data: {
        staffId: data.staffId,
        payrollId: data.payrollId,
        bankCode: data.bankCode.trim(),
        bankName: data.bankName.trim(),
        accountNumber: data.accountNumber.trim(),
        accountName: data.accountName.trim(),
        amount,
        narration: data.narration?.trim(),
        reference: data.reference?.trim() || 'PWFB-SAL-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        batchReference: data.batchReference?.trim(),
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : new Date(),
      },
      include: { staff: true, payroll: true },
    });
  }

  async cooperative(query?: string) {
    const customers = await this.prisma.customer.findMany({
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      include: { savings: true, loans: { include: { repayments: true } } },
    });
    const q = query?.trim().toLowerCase();
    return customers
      .map((customer) => {
        const savingsBalance = customer.savings.reduce((sum, row) => sum + Number(row.amount), 0);
        const loanIssued = customer.loans.reduce((sum, row) => sum + Number(row.amount), 0);
        const loanPaid = customer.loans.reduce((sum, loan) => sum + loan.repayments.reduce((s, r) => s + Number(r.amount), 0), 0);
        return {
          customerId: customer.id,
          name: [customer.firstName, customer.middleName, customer.lastName].filter(Boolean).join(' '),
          phone: customer.phone,
          savingsBalance,
          loanIssued,
          loanPaid,
          loanBalance: Math.max(0, loanIssued - loanPaid),
        };
      })
      .filter((row) => !q || Object.values(row).join(' ').toLowerCase().includes(q));
  }

  async dashboard(periodId?: string, branchId?: string) {
    const [payroll, disbursements, cooperative] = await Promise.all([
      this.payrollSummary(periodId, branchId),
      this.disbursements(),
      this.cooperative(),
    ]);
    return {
      payroll,
      disbursementCount: disbursements.length,
      disbursementTotal: disbursements.reduce((sum, row) => sum + Number(row.amount), 0),
      cooperativeMembers: cooperative.length,
      cooperativeSavings: cooperative.reduce((sum, row) => sum + row.savingsBalance, 0),
      cooperativeLoanBalance: cooperative.reduce((sum, row) => sum + row.loanBalance, 0),
      currency: 'NGN',
    };
  }
}
