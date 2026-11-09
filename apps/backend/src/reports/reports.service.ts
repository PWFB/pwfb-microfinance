import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private readonly accessScope: AccessScopeService) {}

  private async scopeWhere(user: any) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return { customers: {}, staff: {}, loans: {}, savings: {}, transactions: {}, repayments: {}, collections: {}, walletTransactions: {}, cashbook: {} };
    let branchIds: string[] = [];
    if (scope.role === 'REGIONAL_MANAGER' && scope.regionId) {
      branchIds = (await this.prisma.branch.findMany({ where: { regionId: scope.regionId }, select: { id: true } })).map(x => x.id);
    } else if (scope.role === 'DIVISIONAL_MANAGER' && scope.divisionId) {
      branchIds = (await this.prisma.branch.findMany({ where: { divisionId: scope.divisionId }, select: { id: true } })).map(x => x.id);
    } else if (scope.role === 'AREA_MANAGER' && scope.areaId) {
      branchIds = (await this.prisma.branch.findMany({ where: { areaId: scope.areaId }, select: { id: true } })).map(x => x.id);
    } else if (scope.branchId) branchIds = [scope.branchId];
    const branch = { in: branchIds };
    const customers: any = { branchId: branch };
    if (scope.role === 'CREDIT_OFFICER') customers.assignedStaffId = scope.staffId || '__NO_STAFF_ASSIGNMENT__';
    const staff: any = { branchId: branch };
    const loans = { customer: customers };
    const savings = { customer: customers };
    const transactions = { customer: customers };
    const repayments = { loan: { customer: customers } };
    const collections: any = { branchId: branch };
    const walletTransactions: any = { branchId: branch };
    const cashbook = { branchId: branch };
    if (scope.role === 'CREDIT_OFFICER') { collections.staffId = scope.staffId || '__NO_STAFF_ASSIGNMENT__'; walletTransactions.staffId = scope.staffId || '__NO_STAFF_ASSIGNMENT__'; }
    return { customers, staff, loans, savings, transactions, repayments, collections, walletTransactions, cashbook };
  }

  async getSummary(user: any) {
    const scope = await this.scopeWhere(user);
    const [totalCustomers, savingsCount, savingsTotal, loansCount, loansTotal, transactionsCount, transactionsTotal, repaymentsCount, repaymentsTotal, collectionsCount, collectionsTotal, cashInTotal, cashOutTotal] = await Promise.all([
      this.prisma.customer.count({ where: scope.customers }),
      this.prisma.savings.count({ where: scope.savings }),
      this.prisma.savings.aggregate({ where: scope.savings, _sum: { amount: true } }),
      this.prisma.loan.count({ where: scope.loans }),
      this.prisma.loan.aggregate({ where: scope.loans, _sum: { amount: true } }),
      this.prisma.transaction.count({ where: scope.transactions }),
      this.prisma.transaction.aggregate({ where: scope.transactions, _sum: { amount: true } }),
      this.prisma.repayment.count({ where: scope.repayments }),
      this.prisma.repayment.aggregate({ where: scope.repayments, _sum: { amount: true } }),
      this.prisma.dailyCollection.count({ where: scope.collections }),
      this.prisma.dailyCollection.aggregate({ where: scope.collections, _sum: { amount: true } }),
      this.prisma.cashbookEntry.aggregate({ where: { ...scope.cashbook, type: 'CASH_IN' }, _sum: { amount: true } }),
      this.prisma.cashbookEntry.aggregate({ where: { ...scope.cashbook, type: 'CASH_OUT' }, _sum: { amount: true } }),
    ]);
    const totalSavings = savingsTotal._sum.amount ?? 0;
    const totalLoans = loansTotal._sum.amount ?? 0;
    const totalTransactions = transactionsTotal._sum.amount ?? 0;
    const totalRepayments = repaymentsTotal._sum.amount ?? 0;
    const totalCollections = collectionsTotal._sum.amount ?? 0;
    const cashIn = cashInTotal._sum.amount ?? 0;
    const cashOut = cashOutTotal._sum.amount ?? 0;
    return {
      customers: { count: totalCustomers },
      savings: { count: savingsCount, amount: totalSavings },
      loans: { count: loansCount, amount: totalLoans },
      transactions: { count: transactionsCount, amount: totalTransactions },
      repayments: { count: repaymentsCount, amount: totalRepayments },
      collections: { count: collectionsCount, amount: totalCollections },
      cashbook: { cashIn, cashOut, net: cashIn - cashOut },
      portfolio: { amount: totalSavings + totalLoans },
    };
  }

  async getOperations(query: Record<string, string> = {}, user?: any) {
    const scope = user ? await this.scopeWhere(user) : { customers: {}, staff: {}, loans: {}, savings: {}, transactions: {}, repayments: {}, collections: {}, walletTransactions: {}, cashbook: {} };
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
    const role = String(user?.role || '').toUpperCase();
    const staffFilter = role === 'CREDIT_OFFICER' ? { staffId: (scope.collections as any).staffId } : (staffId ? { staffId } : {});

    const [customers, staff, loans, savings, walletTransactions, collections, cashbook] = await Promise.all([
      this.prisma.customer.findMany({ where: { ...scope.customers, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { middleName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' } }),
      this.prisma.staff.findMany({ where: { ...scope.staff, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' } }),
      this.prisma.loan.findMany({ where: { ...scope.loans, ...dateFilter, ...(customerId ? { customer: { ...scope.customers, id: customerId } } : {}) }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.savings.findMany({ where: { ...scope.savings, ...dateFilter, ...(customerId ? { customer: { ...scope.customers, id: customerId } } : {}) }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletTransaction.findMany({ where: { ...scope.walletTransactions, ...customerFilter, ...staffFilter, ...dateFilter, ...(type ? { type: type as any } : {}) }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dailyCollection.findMany({ where: { ...scope.collections, ...customerFilter, ...staffFilter, ...dateFilter }, include: { customer: true, staff: true, branch: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.cashbookEntry.findMany({ where: { ...scope.cashbook, ...dateFilter }, include: { branch: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const staffById = new Map(staff.map((member: any) => [member.id, member]));
    const attributedWalletTransactions = walletTransactions.map((item: any) => ({ ...item, staff: staffById.get(item.staffId) || null }));
    const deposits = attributedWalletTransactions.filter((x) => x.type === 'DEPOSIT');
    const withdrawals = attributedWalletTransactions.filter((x) => x.type === 'WITHDRAWAL');
    const transfers = attributedWalletTransactions.filter((x) => x.type === 'TRANSFER_OUT' || x.type === 'TRANSFER_IN');
    const cashIn = cashbook.filter((x) => x.type === 'CASH_IN');
    const cashOut = cashbook.filter((x) => x.type === 'CASH_OUT');
    const filterBySearch = (rows: any[]) => search ? rows.filter((x) => {
      const customer = x.customer || {};
      const staffMember = x.staff || {};
      const branch = x.branch || {};
      const haystack = [x.id, x.staffId, x.reference, x.description, x.notes, customer.firstName, customer.middleName, customer.lastName, customer.email, customer.phone, staffMember.staffId, staffMember.firstName, staffMember.lastName, branch.name, x.status, x.type].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search.toLowerCase());
    }) : rows;

    let selected: Record<string, any[]> = {
      customers: filterBySearch(customers),
      staff: filterBySearch(staff),
      loans: filterBySearch(loans),
      savings: filterBySearch(savings),
      deposits: filterBySearch(deposits),
      withdrawals: filterBySearch(withdrawals),
      transfers: filterBySearch(transfers),
      collections: filterBySearch(collections),
      cashIn: filterBySearch(cashIn),
      cashOut: filterBySearch(cashOut),
    };
    if (section !== 'all' && selected[section]) {
      selected = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [], collections: [], cashIn: [], cashOut: [], [section]: selected[section] };
    }

    const total = Object.values(selected).reduce((sum, rows) => sum + rows.length, 0);
    const flattened = Object.entries(selected).flatMap(([kind, rows]) => rows.map(row => ({ ...row, _section: kind })));
    const start = (page - 1) * pageSize;
    const paged = flattened.slice(start, start + pageSize);
    const result: Record<string, any[]> = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [], collections: [], cashIn: [], cashOut: [] };
    for (const row of paged) result[row._section].push(row);

    return {
      ...result,
      pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) },
      filters: { section, search, type, customerId: customerId || '', staffId: staffId || '', from: query.from || '', to: query.to || '' },
    };
  }
}
