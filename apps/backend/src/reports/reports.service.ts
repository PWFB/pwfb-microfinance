import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from '../access/staff-scope.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffScopeService: StaffScopeService,
  ) {}

  async getSummary(authUser: any) {
    const customerWhere = await this.staffScopeService.customerWhere(authUser);
    const loanWhere = Object.keys(customerWhere).length ? { customer: customerWhere } : {};

    const [totalCustomers, savingsCount, savingsTotal, loansCount, loansTotal, transactionsCount, transactionsTotal, repaymentsCount, repaymentsTotal] = await Promise.all([
      this.prisma.customer.count({ where: customerWhere }),
      this.prisma.savings.count({ where: Object.keys(customerWhere).length ? { customer: customerWhere } : undefined }),
      this.prisma.savings.aggregate({ where: Object.keys(customerWhere).length ? { customer: customerWhere } : undefined, _sum: { amount: true } }),
      this.prisma.loan.count({ where: loanWhere }),
      this.prisma.loan.aggregate({ where: loanWhere, _sum: { amount: true } }),
      this.prisma.transaction.count({ where: Object.keys(customerWhere).length ? { customer: customerWhere } : undefined }),
      this.prisma.transaction.aggregate({ where: Object.keys(customerWhere).length ? { customer: customerWhere } : undefined, _sum: { amount: true } }),
      this.prisma.repayment.count({ where: Object.keys(customerWhere).length ? { loan: { customer: customerWhere } } : undefined }),
      this.prisma.repayment.aggregate({ where: Object.keys(customerWhere).length ? { loan: { customer: customerWhere } } : undefined, _sum: { amount: true } }),
    ]);

    const totalSavings = savingsTotal._sum.amount ?? 0;
    const totalLoans = loansTotal._sum.amount ?? 0;
    const totalTransactions = transactionsTotal._sum.amount ?? 0;
    const totalRepayments = repaymentsTotal._sum.amount ?? 0;
    return {
      customers: { count: totalCustomers },
      savings: { count: savingsCount, amount: totalSavings },
      loans: { count: loansCount, amount: totalLoans },
      transactions: { count: transactionsCount, amount: totalTransactions },
      repayments: { count: repaymentsCount, amount: totalRepayments },
      portfolio: { amount: totalSavings + totalLoans },
    };
  }

  async getOperations(query: Record<string, string> = {}, authUser?: any) {
    const section = query.section || 'all';
    const search = (query.search || '').trim();
    const type = (query.type || '').trim().toUpperCase();
    const customerId = query.customerId?.trim();
    const staffId = query.staffId?.trim();
    const page = Math.max(Number.parseInt(query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize || '50', 10) || 50, 1), 200);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    const dateFilter = from && !Number.isNaN(from.getTime()) || to && !Number.isNaN(to.getTime())
      ? { createdAt: { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) } }
      : {};

    const customerScope = authUser ? await this.staffScopeService.customerWhere(authUser) : {};
    const staffScope = authUser ? await this.staffScopeService.staffWhere(authUser) : {};
    const scopedCustomerFilter = Object.keys(customerScope).length ? { customer: customerScope } : {};
    const scopedLoanFilter = Object.keys(customerScope).length ? { customer: customerScope } : {};
    const scopedStaffFilter = Object.keys(staffScope).length ? staffScope : undefined;
    const requestedCustomerFilter = customerId ? { customerId } : {};
    const requestedStaffFilter = staffId ? { staffId } : {};

    const [customers, staff, loans, savings, repayments, walletTransactions] = await Promise.all([
      this.prisma.customer.findMany({ where: { ...customerScope, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { middleName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' } }),
      this.prisma.staff.findMany({ where: { ...(scopedStaffFilter || {}), ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { middleName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' }, include: { assignments: { orderBy: { startsAt: 'desc' }, include: { region: true, division: true, area: true, branch: true } }, branch: true } }),
      this.prisma.loan.findMany({ where: { ...requestedCustomerFilter, ...dateFilter, ...scopedLoanFilter }, include: { customer: true, repayments: true, guarantors: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.savings.findMany({ where: { ...requestedCustomerFilter, ...dateFilter, ...scopedCustomerFilter }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.repayment.findMany({ where: { ...dateFilter, ...(customerId ? { loan: { customerId } } : {}), ...(Object.keys(customerScope).length ? { loan: { customer: { ...customerScope } } } : {}) }, include: { loan: { include: { customer: true } } }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletTransaction.findMany({ where: { ...requestedCustomerFilter, ...(staffId ? requestedStaffFilter : {}), ...dateFilter, ...(type ? { type: type as any } : {}), ...(Object.keys(customerScope).length ? { customer: customerScope } : {}) }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const deposits = walletTransactions.filter((x) => x.type === 'DEPOSIT');
    const withdrawals = walletTransactions.filter((x) => x.type === 'WITHDRAWAL');
    const transfers = walletTransactions.filter((x) => x.type === 'TRANSFER_OUT' || x.type === 'TRANSFER_IN');
    const filterBySearch = (rows: any[]) => search ? rows.filter((x) => {
      const customer = x.customer || x.loan?.customer || {};
      const haystack = [x.id, x.reference, x.description, customer.firstName, customer.middleName, customer.lastName, customer.email, customer.phone, x.status, x.type].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    }) : rows;

    let selected: Record<string, any[]> = {
      customers: filterBySearch(customers),
      staff: filterBySearch(staff),
      loans: filterBySearch(loans),
      savings: filterBySearch(savings),
      repayments: filterBySearch(repayments),
      deposits: filterBySearch(deposits),
      withdrawals: filterBySearch(withdrawals),
      transfers: filterBySearch(transfers),
    };
    if (section !== 'all' && selected[section]) {
      selected = { customers: [], staff: [], loans: [], savings: [], repayments: [], deposits: [], withdrawals: [], transfers: [], [section]: selected[section] };
    }

    const total = Object.values(selected).reduce((sum, rows) => sum + rows.length, 0);
    const flattened = Object.entries(selected).flatMap(([kind, rows]) => rows.map(row => ({ ...row, _section: kind })));
    const start = (page - 1) * pageSize;
    const paged = flattened.slice(start, start + pageSize);
    const result: Record<string, any[]> = { customers: [], staff: [], loans: [], savings: [], repayments: [], deposits: [], withdrawals: [], transfers: [] };
    for (const row of paged) result[row._section].push(row);

    return {
      ...result,
      pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) },
      filters: { section, search, type, customerId: customerId || '', staffId: staffId || '', from: query.from || '', to: query.to || '' },
    };
  }
}
