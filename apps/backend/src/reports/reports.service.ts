import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}

  private async scopedFilters(user: any) {
    const scope = await this.accessScope.getScope(user);
    if (scope.global) return { global: true, branchIds: null as string[] | null, staffId: null as string | null, empty: false };
    const branchIds = await this.accessScope.getBranchIds(user);
    return {
      global: false,
      branchIds,
      staffId: scope.role === 'CREDIT_OFFICER' ? scope.staffId : null,
      empty: !branchIds?.length,
    };
  }

  private customerScope(filters: any) {
    if (filters.global) return {};
    if (filters.empty) return { id: { in: [] } };
    return {
      branchId: { in: filters.branchIds },
      ...(filters.staffId ? { assignedStaffId: filters.staffId } : {}),
    };
  }

  private async scopedCashbookWhere(user: any) {
    const filters = await this.scopedFilters(user);
    if (filters.global) return {};
    if (filters.empty) return { id: { in: [] } };
    return { branchId: { in: filters.branchIds } };
  }

  async getSummary(user: any) {
    const filters = await this.scopedFilters(user);
    const customersWhere = this.customerScope(filters);
    const customerRelation = filters.global ? {} : { customer: { is: customersWhere } };
    // CashbookEntry has no collector Staff ID yet. Do not expose whole-branch
    // cashbook totals to an individual Credit Officer until attribution is reliable.
    const cashbookWhere = filters.global ? {} : filters.empty || filters.staffId ? { id: { in: [] } } : { branchId: { in: filters.branchIds } };
    const [totalCustomers, savingsCount, savingsTotal, loansCount, loansTotal, transactionsCount, transactionsTotal, repaymentsCount, repaymentsTotal, collectionsCount, collectionsTotal, cashInTotal, cashOutTotal] = await Promise.all([
      this.prisma.customer.count({ where: customersWhere }),
      this.prisma.savings.count({ where: customerRelation }),
      this.prisma.savings.aggregate({ where: customerRelation, _sum: { amount: true } }),
      this.prisma.loan.count({ where: customerRelation }),
      this.prisma.loan.aggregate({ where: customerRelation, _sum: { amount: true } }),
      this.prisma.transaction.count({ where: customerRelation }),
      this.prisma.transaction.aggregate({ where: customerRelation, _sum: { amount: true } }),
      this.prisma.repayment.count({ where: filters.global ? {} : { loan: { is: { customer: { is: customersWhere } } } } }),
      this.prisma.repayment.aggregate({ where: filters.global ? {} : { loan: { customer: customersWhere } }, _sum: { amount: true } }),
      this.prisma.dailyCollection.count({ where: filters.global ? {} : filters.empty ? { id: { in: [] } } : { branchId: { in: filters.branchIds }, ...(filters.staffId ? { staffId: filters.staffId } : {}) } }),
      this.prisma.dailyCollection.aggregate({ where: filters.global ? {} : filters.empty ? { id: { in: [] } } : { branchId: { in: filters.branchIds }, ...(filters.staffId ? { staffId: filters.staffId } : {}) }, _sum: { amount: true } }),
      this.prisma.cashbookEntry.aggregate({ where: { ...cashbookWhere, type: 'CASH_IN' }, _sum: { amount: true } }),
      this.prisma.cashbookEntry.aggregate({ where: { ...cashbookWhere, type: 'CASH_OUT' }, _sum: { amount: true } }),
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
      scope: filters.global ? 'ORGANIZATION' : filters.staffId ? 'ASSIGNED_OFFICER' : 'ASSIGNED_BRANCHES',
    };
  }

  async getOperations(query: Record<string, string> = {}, user: any) {
    const filters = await this.scopedFilters(user);
    const section = query.section || 'all';
    const search = (query.search || '').trim();
    const type = (query.type || '').trim().toUpperCase();
    const customerId = query.customerId?.trim();
    const requestedStaffId = query.staffId?.trim();
    if (requestedStaffId && !filters.global) await this.accessScope.assertStaff(user, requestedStaffId);
    if (customerId && !filters.global) await this.accessScope.assertCustomer(user, customerId);
    const staffId = filters.staffId || requestedStaffId;
    const page = Math.max(Number.parseInt(query.page || '1', 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(query.pageSize || '50', 10) || 50, 1), 200);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    const dateFilter = from && !Number.isNaN(from.getTime()) || to && !Number.isNaN(to.getTime())
      ? { createdAt: { ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}), ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}) } }
      : {};
    const customerFilter = customerId ? { customerId } : {};
    const staffFilter = staffId ? { staffId } : {};
    const customerScope = this.customerScope(filters);
    const relationScope = filters.global ? {} : { customer: { is: customerScope } };
    const branchScope = filters.global ? {} : filters.empty ? { id: { in: [] } } : { branchId: { in: filters.branchIds } };
    const cashbookScope = filters.global ? {} : filters.empty || filters.staffId ? { id: { in: [] } } : { branchId: { in: filters.branchIds } };
    const staffScope = filters.global ? {} : filters.empty ? { id: { in: [] } } : filters.staffId ? { id: filters.staffId } : { branchId: { in: filters.branchIds } };

    const [customers, staff, loans, savings, walletTransactions, collections, cashbook] = await Promise.all([
      this.prisma.customer.findMany({ where: { ...customerScope, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { middleName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' } }),
      this.prisma.staff.findMany({ where: { ...staffScope, ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }, { phone: { contains: search } }] } : {}) }, orderBy: { createdAt: 'desc' } }),
      this.prisma.loan.findMany({ where: { ...customerFilter, ...dateFilter, ...relationScope }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.savings.findMany({ where: { ...customerFilter, ...dateFilter, ...relationScope }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletTransaction.findMany({ where: { ...customerFilter, ...staffFilter, ...dateFilter, ...(type ? { type: type as any } : {}), ...relationScope }, include: { customer: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.dailyCollection.findMany({ where: { ...customerFilter, ...staffFilter, ...dateFilter, ...branchScope }, include: { customer: true, staff: true, branch: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.cashbookEntry.findMany({ where: { ...dateFilter, ...cashbookScope }, include: { branch: true }, orderBy: { createdAt: 'desc' } }),
    ]);

    const deposits = walletTransactions.filter((x) => x.type === 'DEPOSIT');
    const withdrawals = walletTransactions.filter((x) => x.type === 'WITHDRAWAL');
    const transfers = walletTransactions.filter((x) => x.type === 'TRANSFER_OUT' || x.type === 'TRANSFER_IN');
    const cashIn = cashbook.filter((x) => x.type === 'CASH_IN');
    const cashOut = cashbook.filter((x) => x.type === 'CASH_OUT');
    const filterBySearch = (rows: any[]) => search ? rows.filter((x) => {
      const customer = x.customer || {};
      const staffMember = x.staff || {};
      const branch = x.branch || {};
      const haystack = [x.id, x.reference, x.description, x.notes, customer.firstName, customer.middleName, customer.lastName, customer.email, customer.phone, staffMember.staffId, staffMember.firstName, staffMember.lastName, branch.name, x.status, x.type].filter(Boolean).join(' ').toLowerCase();
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
      filters: { section, search, type, customerId: customerId || '', staffId: staffId || '', from: query.from || '', to: query.to || '', scope: filters.global ? 'ORGANIZATION' : filters.staffId ? 'ASSIGNED_OFFICER' : 'ASSIGNED_BRANCHES' },
    };
  }
}
