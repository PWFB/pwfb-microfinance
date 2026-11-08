import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';
import { AccessScopeService } from '../access/access-scope.service';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}
  private amount(value: unknown) { const n=Number(value); if(!Number.isFinite(n)||n<=0) throw new BadRequestException('Repayment amount must be greater than zero'); return Math.round(n*100)/100; }
  private async ensureAllocationTable(tx:any=this.prisma) { await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" ("repaymentId" TEXT PRIMARY KEY,"principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`); }
  private async allocate(tx:any,loanId:string,repaymentId:string,amount:number) {
    const loan=await tx.loan.findUnique({where:{id:loanId}}); if(!loan) throw new NotFoundException('Loan not found');
    const metaRows=await tx.$queryRawUnsafe(`SELECT "interestAmount" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,loanId) as Array<{interestAmount:number|string|null}>;
    const interestAmount=Number(metaRows[0]?.interestAmount ?? (Number(loan.amount||0)*Number(loan.interestRate||0)/100));
    const prior=await tx.$queryRawUnsafe(`SELECT COALESCE(SUM("interestPaid"),0) AS "interestPaid", COALESCE(SUM("principalPaid"),0) AS "principalPaid" FROM "PWFBRepaymentAllocation" a JOIN "Repayment" r ON r.id=a."repaymentId" WHERE r."loanId"=$1 AND r.id<>$2`,loanId,repaymentId) as Array<{interestPaid:number|string;principalPaid:number|string}>;
    const priorInterest=Number(prior[0]?.interestPaid||0), priorPrincipal=Number(prior[0]?.principalPaid||0);
    const interestRemaining=Math.max(0,interestAmount-priorInterest), principalRemaining=Math.max(0,Number(loan.amount||0)-priorPrincipal);
    const interestPaid=Math.min(amount,interestRemaining), principalPaid=Math.min(Math.max(0,amount-interestPaid),principalRemaining);
    const allocated=Math.round((interestPaid+principalPaid)*100)/100;
    if(allocated<Math.round(amount*100)/100) throw new BadRequestException(`Repayment exceeds the outstanding loan balance. Outstanding: ₦${(interestRemaining+principalRemaining).toFixed(2)}`);
    await tx.$executeRawUnsafe(`INSERT INTO "PWFBRepaymentAllocation" ("repaymentId","principalPaid","interestPaid","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP) ON CONFLICT ("repaymentId") DO UPDATE SET "principalPaid"=$2,"interestPaid"=$3,"updatedAt"=CURRENT_TIMESTAMP`,repaymentId,principalPaid,interestPaid);
    return {principalPaid,interestPaid,principalOutstanding:Math.max(0,principalRemaining-principalPaid),interestOutstanding:Math.max(0,interestRemaining-interestPaid)};
  }
  async create(dto: CreateRepaymentDto, user: any) {
    const amount = this.amount(dto.amount);
    const method = String(dto.method || 'Cash').trim().toUpperCase();
    if (method !== 'CASH') {
      throw new BadRequestException('Manual repayments accept physical cash only. Bank transfers, card and mobile-money repayments must be credited through a verified provider settlement.');
    }
    if (dto.cashReceivedConfirmed !== true) {
      throw new BadRequestException('Confirm that the cash repayment has physically been received and counted before saving.');
    }

    const loan = await this.prisma.loan.findUnique({
      where: { id: dto.loanId },
      include: { customer: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    await this.accessScope.assertLoan(user, loan.id);

    const scope = await this.accessScope.getScope(user);
    const staffId = String(scope.staffId || '').trim();
    if (!staffId) throw new BadRequestException('The collecting user must be linked to an active Staff ID');
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: { id: true, staffId: true, branchId: true, employmentStatus: true },
    });
    if (!staff || staff.employmentStatus !== 'ACTIVE' || !staff.branchId) {
      throw new BadRequestException('Cash repayment requires an active branch-assigned Staff ID');
    }
    if (!loan.customer.branchId || staff.branchId !== loan.customer.branchId) {
      throw new BadRequestException('Cash repayment collector and borrower must belong to the same branch');
    }
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    if (Number.isNaN(paymentDate.getTime())) throw new BadRequestException('Invalid repayment date');
    const paymentDay = paymentDate.toISOString().slice(0, 10);
    const reference = String(dto.reference || '').trim();
    if (!reference || reference.length > 120) {
      throw new BadRequestException('A unique cash receipt reference is required for every repayment');
    }

    const period = await this.prisma.financialPeriod.findFirst({
      where: { status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });
    if (!period) throw new BadRequestException('An open financial period is required before accepting cash repayments');
    const startDay = new Date(period.startDate).toISOString().slice(0, 10);
    const endDay = new Date(period.endDate).toISOString().slice(0, 10);
    if (paymentDay < startDay || paymentDay > endDay) {
      throw new BadRequestException('Repayment date must fall inside the current open financial period');
    }

    await this.ensureAllocationTable();
    return this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', `CASH-REPAYMENT:${reference}`);
      const duplicate = await tx.repayment.findFirst({ where: { reference }, select: { id: true } });
      if (duplicate) throw new BadRequestException('This cash repayment reference has already been recorded');
      const cashbookReference = `REPAY-${reference}`;
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', `CASHBOOK:${staff.branchId}:${cashbookReference}`);
      const duplicateCashbook = await tx.cashbookEntry.findFirst({
        where: { branchId: staff.branchId, reference: cashbookReference },
        select: { id: true },
      });
      if (duplicateCashbook) throw new BadRequestException('This repayment reference already exists in the branch cashbook');

      const repayment = await tx.repayment.create({
        data: {
          loanId: loan.id,
          amount,
          paymentDate,
          method: 'CASH',
          notes: dto.notes,
          periodId: period.id,
          branchId: staff.branchId,
          staffId: staff.id,
          reference,
        },
        include: { loan: { include: { customer: true } }, staff: true, branch: true },
      });
      const allocation = await this.allocate(tx, loan.id, repayment.id, amount);
      const description = `Cash loan repayment ${reference} received by Staff ID ${staff.staffId} for loan ${loan.id} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`;
      const transaction = await tx.transaction.create({
        data: {
          customerId: loan.customerId,
          type: 'LOAN_REPAYMENT',
          amount,
          description,
          periodId: period.id,
        },
      });
      const cashbookEntry = await tx.cashbookEntry.create({
        data: {
          periodId: period.id,
          branchId: staff.branchId,
          staffId: staff.id,
          type: 'CASH_IN',
          amount,
          reference: cashbookReference,
          description,
          entryDate: paymentDate,
        },
      });
      return { ...repayment, ...allocation, transaction, cashbookEntry };
    });
  }
  async listBulkDailyLoans(date: string, user: any) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new BadRequestException('Choose a valid repayment date');
    const start = new Date(`${date}T00:00:00.000+01:00`);
    const end = new Date(`${date}T23:59:59.999+01:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Choose a valid repayment date');
    const scope = await this.accessScope.getScope(user);
    const branchIds = scope.global ? [] : (await this.accessScope.getBranchIds(user)) || [];
    if (!scope.global && !branchIds.length) return { date, count: 0, loans: [], duplicateAccounts: [] };
    if (['TELLER', 'CREDIT_OFFICER'].includes(scope.role) && !scope.staffId) throw new BadRequestException('Your login is not linked to an active Staff ID');

    const customerWhere: any = scope.global ? {} : { branchId: { in: branchIds }, ...(scope.role === 'CREDIT_OFFICER' ? { assignedStaffId: scope.staffId } : {}) };
    const loans = await this.prisma.loan.findMany({
      where: { customer: { is: customerWhere }, status: { in: ['DISBURSED', 'ACTIVE'] } },
      orderBy: { createdAt: 'asc' },
      include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] } } }, repayments: true },
    });
    if (!loans.length) return { date, count: 0, loans: [], duplicateAccounts: [] };
    const loanIds = loans.map(loan => loan.id);
    const metaRows = await this.prisma.$queryRawUnsafe<Array<{
      loanId: string; loanType: string | null; duration: number | string | null;
      repaymentFrequency: string | null; totalRepayment: number | string | null;
      installmentAmount: number | string | null; interestAmount: number | string | null;
    }>>(
      `SELECT "loanId","loanType","duration","repaymentFrequency","totalRepayment","installmentAmount","interestAmount" FROM "PWFBLoanMeta" WHERE "loanId" = ANY($1::text[])`,
      loanIds,
    );
    const metaByLoan = new Map(metaRows.map(row => [row.loanId, row]));
    const rows: any[] = [];
    const accountGroups = new Map<string, any[]>();

    for (const loan of loans as any[]) {
      const meta = metaByLoan.get(loan.id);
      const frequency = String(meta?.repaymentFrequency || '').trim().toLowerCase();
      if (!frequency.includes('daily')) continue;
      const duration = Math.max(1, Math.ceil(Number(meta?.duration || 1)));
      const totalRepayment = Number(meta?.totalRepayment ?? (Number(loan.amount || 0) + Number(meta?.interestAmount ?? (Number(loan.amount || 0) * Number(loan.interestRate || 0) / 100))));
      const installmentAmount = Number(meta?.installmentAmount ?? (totalRepayment / duration));
      if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) continue;
      const loanStart = new Date(loan.createdAt);
      const dayOffset = Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
        Date.UTC(loanStart.getUTCFullYear(), loanStart.getUTCMonth(), loanStart.getUTCDate())) / 86400000);
      const dueInstallments = Math.max(0, Math.min(duration, dayOffset));
      if (dueInstallments <= 0) continue;
      const dueToDate = Math.round(Math.min(totalRepayment, installmentAmount * dueInstallments) * 100) / 100;
      const repayments = Array.isArray(loan.repayments) ? loan.repayments : [];
      const paidToDate = Math.round(repayments.filter((item: any) => new Date(item.paymentDate || item.createdAt) <= end).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) * 100) / 100;
      const paidToday = Math.round(repayments.filter((item: any) => { const paidAt = new Date(item.paymentDate || item.createdAt); return paidAt >= start && paidAt <= end; }).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) * 100) / 100;
      const remainingDue = Math.max(0, Math.round((dueToDate - paidToDate) * 100) / 100);
      const primary = loan.customer?.bankAccounts?.[0] || null;
      const bankCode = String(primary?.institution?.code || '');
      const accountNumber = String(primary?.accountNumber || '').replace(/\D/g, '');
      const accountKey = accountNumber && bankCode ? `${bankCode}:${accountNumber}` : '';
      const customerName = [loan.customer?.firstName, loan.customer?.middleName, loan.customer?.lastName].filter(Boolean).join(' ');
      const item = {
        loanId: loan.id, clientId: loan.customerId, customerName, phone: loan.customer?.phone || null,
        branchId: loan.customer?.branchId || null, amount: Number(loan.amount || 0),
        loanType: meta?.loanType || 'Loan', repaymentFrequency: meta?.repaymentFrequency || 'Daily',
        duration, installmentAmount: Math.round(installmentAmount * 100) / 100,
        dueToDate, paidToDate, paidToday, remainingDue,
        status: remainingDue <= 0.005 ? 'PAID' : 'UNPAID',
        account: primary ? { accountNumber: primary.accountNumber, accountName: primary.accountName, bankCode, bankName: primary.institution?.name || primary.institution?.shortName || 'Registered bank', verified: Boolean(primary.verifiedAt), primary: Boolean(primary.isPrimary) } : null,
        duplicateAccount: false, duplicateAccountCustomers: [] as any[],
      };
      rows.push(item);
      if (accountKey) {
        const group = accountGroups.get(accountKey) || [];
        group.push({ clientId: item.clientId, customerName: item.customerName, loanId: item.loanId, accountNumber: primary.accountNumber, accountName: primary.accountName, bankName: item.account?.bankName });
        accountGroups.set(accountKey, group);
      }
    }
    const duplicateAccounts = [...accountGroups.entries()]
      .filter(([, group]) => group.length > 1)
      .map(([key, customers]) => ({ key, accountNumber: customers[0].accountNumber, bankName: customers[0].bankName, customers }));
    for (const loan of rows) {
      const key = loan.account ? `${loan.account.bankCode}:${String(loan.account.accountNumber || '').replace(/\D/g, '')}` : '';
      const duplicate = duplicateAccounts.find(group => group.key === key);
      if (duplicate) { loan.duplicateAccount = true; loan.duplicateAccountCustomers = duplicate.customers; }
    }
    return {
      date, count: rows.length, paidCount: rows.filter(row => row.status === 'PAID').length,
      unpaidCount: rows.filter(row => row.status === 'UNPAID').length,
      totalDue: Math.round(rows.reduce((sum, row) => sum + row.remainingDue, 0) * 100) / 100,
      totalPaidToday: Math.round(rows.reduce((sum, row) => sum + row.paidToday, 0) * 100) / 100,
      duplicateAccountCount: duplicateAccounts.length, duplicateAccounts, loans: rows,
    };
  }

  async createBulkCashRepayments(input: {
    date: string; batchReference: string; cashReceivedConfirmed: boolean;
    items: Array<{ loanId: string; amount: number }>; notes?: string;
  }, user: any) {
    if (input?.cashReceivedConfirmed !== true) throw new BadRequestException('Confirm that the full bulk cash amount has been physically received and counted');
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 50) throw new BadRequestException('Select between 1 and 50 daily loan repayments per batch');
    const batchReference = String(input.batchReference || '').trim();
    if (!/^[A-Za-z0-9._-]{4,60}$/.test(batchReference)) throw new BadRequestException('Enter a unique batch reference (4–60 letters, numbers, dots, underscores or hyphens)');
    const ids = input.items.map(item => String(item.loanId || '').trim());
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) throw new BadRequestException('Each loan may appear only once in a bulk cash repayment batch');
    const amounts = input.items.map(item => this.amount(item.amount));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) throw new BadRequestException('Choose a valid bulk repayment date');
    const paymentDate = new Date(`${input.date}T12:00:00.000+01:00`);
    if (Number.isNaN(paymentDate.getTime())) throw new BadRequestException('Choose a valid bulk repayment date');
    const scope = await this.accessScope.getScope(user);
    const staffId = String(scope.staffId || '').trim();
    if (!staffId) throw new BadRequestException('Bulk cash collection requires an active Staff ID');
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId }, select: { id: true, staffId: true, branchId: true, employmentStatus: true } });
    if (!staff || staff.employmentStatus !== 'ACTIVE' || !staff.branchId) throw new BadRequestException('Bulk cash collection requires an active branch-assigned staff member');
    const loanRows = await this.prisma.loan.findMany({ where: { id: { in: ids } }, include: { customer: true } });
    if (loanRows.length !== ids.length) throw new NotFoundException('One or more selected loans could not be found');
    const loanById = new Map(loanRows.map(loan => [loan.id, loan]));
    for (const id of ids) {
      const loan: any = loanById.get(id);
      if (!loan || !loan.customer?.branchId || loan.customer.branchId !== staff.branchId) throw new BadRequestException('Every selected loan and borrower must belong to your assigned branch');
      if (!['DISBURSED', 'ACTIVE'].includes(String(loan.status || '').toUpperCase())) throw new BadRequestException(`Loan ${id} is not an active disbursed loan eligible for repayment`);
      await this.accessScope.assertLoan(user, id);
    }
    const period = await this.prisma.financialPeriod.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    if (!period) throw new BadRequestException('An open financial period is required before bulk cash collection');
    const day = paymentDate.toISOString().slice(0, 10);
    if (day < new Date(period.startDate).toISOString().slice(0, 10) || day > new Date(period.endDate).toISOString().slice(0, 10)) throw new BadRequestException('Bulk repayment date must fall inside the open financial period');
    await this.ensureAllocationTable();
    const totalAmount = Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100;
    const items = await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', `BULK-REPAYMENT:${staff.branchId}:${batchReference}`);
      const duplicateBatch = await tx.repayment.findFirst({ where: { reference: { startsWith: `BULK-${batchReference}-` } }, select: { id: true } });
      if (duplicateBatch) throw new BadRequestException('This bulk payment batch reference has already been used');
      const results: any[] = [];
      for (let index = 0; index < ids.length; index++) {
        const loanId = ids[index], amount = amounts[index], loan: any = loanById.get(loanId);
        await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', `LOAN-REPAYMENT:${loanId}`);
        const meta = await tx.$queryRawUnsafe<Array<{
          repaymentFrequency: string | null; duration: number | string | null;
          totalRepayment: number | string | null; installmentAmount: number | string | null;
          interestAmount: number | string | null;
        }>>(
          `SELECT "repaymentFrequency","duration","totalRepayment","installmentAmount","interestAmount" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`, loanId,
        );
        if (!String(meta[0]?.repaymentFrequency || '').toLowerCase().includes('daily')) throw new BadRequestException(`Loan ${loanId} is not configured for daily repayments`);
        const duration = Math.max(1, Math.ceil(Number(meta[0]?.duration || 1)));
        const fullRepayment = Number(meta[0]?.totalRepayment ?? (Number(loan.amount || 0) + Number(meta[0]?.interestAmount ?? (Number(loan.amount || 0) * Number(loan.interestRate || 0) / 100))));
        const installment = Number(meta[0]?.installmentAmount ?? (fullRepayment / duration));
        const loanStart = new Date(loan.createdAt);
        const dueDays = Math.max(0, Math.min(duration, Math.floor((Date.UTC(paymentDate.getUTCFullYear(), paymentDate.getUTCMonth(), paymentDate.getUTCDate()) - Date.UTC(loanStart.getUTCFullYear(), loanStart.getUTCMonth(), loanStart.getUTCDate())) / 86400000)));
        const amountDueToDate = Math.round(Math.min(fullRepayment, installment * dueDays) * 100) / 100;
        const alreadyPaid = await tx.repayment.aggregate({
          where: { loanId, paymentDate: { lte: paymentDate } },
          _sum: { amount: true },
        });
        const outstandingDue = Math.max(0, Math.round((amountDueToDate - Number(alreadyPaid._sum?.amount || 0)) * 100) / 100);
        if (outstandingDue <= 0.005) throw new BadRequestException(`Loan ${loanId} is already paid for the selected date`);
        if (amount > outstandingDue + 0.005) throw new BadRequestException(`Bulk amount for loan ${loanId} exceeds its remaining daily repayment due of ₦${outstandingDue.toFixed(2)}`);
        const reference = `BULK-${batchReference}-${loanId}`, cashbookReference = `REPAY-${reference}`;
        const duplicate = await tx.repayment.findFirst({ where: { reference }, select: { id: true } });
        if (duplicate) throw new BadRequestException(`A repayment already exists for loan ${loanId} with this batch reference`);
        const duplicateCashbook = await tx.cashbookEntry.findFirst({ where: { branchId: staff.branchId, reference: cashbookReference }, select: { id: true } });
        if (duplicateCashbook) throw new BadRequestException(`Cashbook entry already exists for loan ${loanId}`);
        const repayment = await tx.repayment.create({
          data: { loanId, amount, paymentDate, method: 'CASH', notes: input.notes, periodId: period.id, branchId: staff.branchId, staffId: staff.id, reference },
          include: { loan: { include: { customer: true } }, staff: true, branch: true },
        });
        const allocation = await this.allocate(tx, loanId, repayment.id, amount);
        const description = `Bulk cash repayment ${batchReference} for Client ID ${loan.customerId}, Loan ID ${loanId}; received by Staff ID ${staff.staffId}`;
        const transaction = await tx.transaction.create({ data: { customerId: loan.customerId, type: 'LOAN_REPAYMENT', amount, description, periodId: period.id } });
        const cashbookEntry = await tx.cashbookEntry.create({
          data: { periodId: period.id, branchId: staff.branchId, staffId: staff.id, type: 'CASH_IN', amount, reference: cashbookReference, description, entryDate: paymentDate },
        });
        results.push({ ...repayment, ...allocation, transaction, cashbookEntry });
      }
      return results;
    }, { timeout: 30000 });
    return { batchReference, paymentCount: items.length, totalAmount, branchId: staff.branchId, staffId: staff.staffId, items };
  }

  async findAll(user:any){await this.ensureAllocationTable(); const scope=await this.accessScope.getScope(user); const branchIds=scope.global?null:await this.accessScope.getBranchIds(user); if(!scope.global&&!branchIds?.length)return []; const customerWhere=scope.global?{}:scope.role==='CREDIT_OFFICER'?{branchId:{in:branchIds!},assignedStaffId:scope.staffId||'__NO_STAFF__'}:{branchId:{in:branchIds!}}; const rows=await this.prisma.repayment.findMany({where:scope.global?{}:{loan:{is:{customer:{is:customerWhere}}}},orderBy:{createdAt:'desc'},include:{loan:{include:{customer:true}},staff:true,branch:true}}); return Promise.all(rows.map(async repayment=>{const allocation=await this.prisma.$queryRawUnsafe(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,repayment.id) as Array<{principalPaid:number|string;interestPaid:number|string}>; return {...repayment,principalPaid:Number(allocation[0]?.principalPaid||0),interestPaid:Number(allocation[0]?.interestPaid||0)};}));}
  async findOne(id:string,user:any){await this.ensureAllocationTable(); const repayment=await this.prisma.repayment.findUnique({where:{id},include:{loan:{include:{customer:true}},staff:true,branch:true}}); if(!repayment)throw new NotFoundException('Repayment not found'); await this.accessScope.assertLoan(user, repayment.loanId); const allocation=await this.prisma.$queryRawUnsafe(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,id) as Array<{principalPaid:number|string;interestPaid:number|string}>; return {...repayment,principalPaid:Number(allocation[0]?.principalPaid||0),interestPaid:Number(allocation[0]?.interestPaid||0)};}
  async update(id:string,dto:UpdateRepaymentDto,user:any){const existing=await this.findOne(id,user); if(['CASH','FIELD_COLLECTION'].includes(String(existing.method||'').toUpperCase())) throw new BadRequestException('Cash repayments with immutable cashbook receipts cannot be edited. Post an approved correcting entry instead.'); if(dto.loanId&&dto.loanId!==existing.loanId) throw new BadRequestException('A repayment cannot be moved to another loan. Create a reversal and a new repayment instead.'); const newAmount=dto.amount===undefined?Number(existing.amount):this.amount(dto.amount),oldAmount=Number(existing.amount),delta=Math.round((newAmount-oldAmount)*100)/100; return this.prisma.$transaction(async tx=>{const repayment=await tx.repayment.update({where:{id},data:{amount:newAmount,paymentDate:dto.paymentDate?new Date(dto.paymentDate):undefined,method:dto.method,notes:dto.notes},include:{loan:{include:{customer:true}}}}); const allocation=await this.allocate(tx,existing.loanId,id,newAmount); if(delta!==0) await tx.transaction.create({data:{customerId:existing.loan.customerId,type:delta>0?'LOAN_REPAYMENT_ADJUSTMENT':'LOAN_REPAYMENT_REVERSAL',amount:Math.abs(delta),description:`Repayment ${id} amount correction from ${oldAmount} to ${newAmount} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`}}); return {...repayment,...allocation};});}
  async remove(id:string,user:any){const existing=await this.findOne(id,user); if(['CASH','FIELD_COLLECTION'].includes(String(existing.method||'').toUpperCase())) throw new BadRequestException('Cash repayments with immutable cashbook receipts cannot be deleted. Post an approved correcting entry instead.'); return this.prisma.$transaction(async tx=>{const deleted=await tx.repayment.delete({where:{id}}); await tx.$executeRawUnsafe(`DELETE FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,id); await tx.transaction.create({data:{customerId:existing.loan.customerId,type:'LOAN_REPAYMENT_REVERSAL',amount:Number(existing.amount),description:`Reversal of deleted loan repayment ${id} — Interest ₦${Number(existing.interestPaid||0).toFixed(2)} / Principal ₦${Number(existing.principalPaid||0).toFixed(2)}`}}); return deleted;});}
}
