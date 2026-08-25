import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [totalCustomers, savingsCount, savingsTotal, loansCount, loansTotal, transactionsCount, transactionsTotal, repaymentsCount, repaymentsTotal] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.savings.count(),
      this.prisma.savings.aggregate({ _sum: { amount: true } }),
      this.prisma.loan.count(),
      this.prisma.loan.aggregate({ _sum: { amount: true } }),
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({ _sum: { amount: true } }),
      this.prisma.repayment.count(),
      this.prisma.repayment.aggregate({ _sum: { amount: true } }),
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

  async getOperations(query: Record<string, string> = {}) {
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
    const customerFilter = customerId ? { customerId } : {};

    const [customers, staff, loans, savings, walletTransactions] = await Promise.all([
      this.prisma.customer.findMany({ where: search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { middleName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : undefined, orderBy: { createdAt: 'desc' } }),
      this.prisma.staff.findMany({ where: search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : undefined, orderBy: { createdAt: 'desc' } }),
      this.prisma.loan.findMany({ where: { ...customerFilter, ...dateFilter }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.savings.findMany({ where: { ...customerFilter, ...dateFilter }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletTransaction.findMany({ where: { ...customerFilter, ...(staffId ? { staffId } : {}), ...dateFilter, ...(type ? { type: type as any } : {}) }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const deposits = walletTransactions.filter((x) => x.type === 'DEPOSIT');
    const withdrawals = walletTransactions.filter((x) => x.type === 'WITHDRAWAL');
    const transfers = walletTransactions.filter((x) => x.type === 'TRANSFER_OUT' || x.type === 'TRANSFER_IN');
    const filterBySearch = (rows: any[]) => search ? rows.filter((x) => {
      const customer = x.customer || {};
      const haystack = [x.id, x.reference, x.description, customer.firstName, customer.middleName, customer.lastName, customer.email, customer.phone, x.status, x.type].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    }) : rows;

    let selected: Record<string, any[]> = { customers: filterBySearch(customers), staff: filterBySearch(staff), loans: filterBySearch(loans), savings: filterBySearch(savings), deposits: filterBySearch(deposits), withdrawals: filterBySearch(withdrawals), transfers: filterBySearch(transfers) };
    if (section !== 'all' && selected[section]) {
      selected = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [], [section]: selected[section] };
    }

    const total = Object.values(selected).reduce((sum, rows) => sum + rows.length, 0);
    const flattened = Object.entries(selected).flatMap(([kind, rows]) => rows.map(row => ({ ...row, _section: kind })));
    const start = (page - 1) * pageSize;
    const paged = flattened.slice(start, start + pageSize);
    const result: Record<string, any[]> = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [] };
    for (const row of paged) result[row._section].push(row);

    return { ...result, pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) }, filters: { section, search, type, customerId: customerId || '', staffId: staffId || '', from: query.from || '', to: query.to || '' } };
  }
}
