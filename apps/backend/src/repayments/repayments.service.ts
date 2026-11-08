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
          reference: `REPAY-${reference}`,
          description,
          entryDate: paymentDate,
        },
      });
      return { ...repayment, ...allocation, transaction, cashbookEntry };
    });
  }
  async findAll(user:any){await this.ensureAllocationTable(); const scope=await this.accessScope.getScope(user); const branchIds=scope.global?null:await this.accessScope.getBranchIds(user); if(!scope.global&&!branchIds?.length)return []; const customerWhere=scope.global?{}:scope.role==='CREDIT_OFFICER'?{branchId:{in:branchIds!},assignedStaffId:scope.staffId||'__NO_STAFF__'}:{branchId:{in:branchIds!}}; const rows=await this.prisma.repayment.findMany({where:scope.global?{}:{loan:{is:{customer:{is:customerWhere}}}},orderBy:{createdAt:'desc'},include:{loan:{include:{customer:true}}}}); return Promise.all(rows.map(async repayment=>{const allocation=await this.prisma.$queryRawUnsafe(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,repayment.id) as Array<{principalPaid:number|string;interestPaid:number|string}>; return {...repayment,principalPaid:Number(allocation[0]?.principalPaid||0),interestPaid:Number(allocation[0]?.interestPaid||0)};}));}
  async findOne(id:string,user:any){await this.ensureAllocationTable(); const repayment=await this.prisma.repayment.findUnique({where:{id},include:{loan:{include:{customer:true}}}}); if(!repayment)throw new NotFoundException('Repayment not found'); await this.accessScope.assertLoan(user, repayment.loanId); const allocation=await this.prisma.$queryRawUnsafe(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,id) as Array<{principalPaid:number|string;interestPaid:number|string}>; return {...repayment,principalPaid:Number(allocation[0]?.principalPaid||0),interestPaid:Number(allocation[0]?.interestPaid||0)};}
  async update(id:string,dto:UpdateRepaymentDto,user:any){const existing=await this.findOne(id,user); if(dto.loanId&&dto.loanId!==existing.loanId) throw new BadRequestException('A repayment cannot be moved to another loan. Create a reversal and a new repayment instead.'); const newAmount=dto.amount===undefined?Number(existing.amount):this.amount(dto.amount),oldAmount=Number(existing.amount),delta=Math.round((newAmount-oldAmount)*100)/100; return this.prisma.$transaction(async tx=>{const repayment=await tx.repayment.update({where:{id},data:{amount:newAmount,paymentDate:dto.paymentDate?new Date(dto.paymentDate):undefined,method:dto.method,notes:dto.notes},include:{loan:{include:{customer:true}}}}); const allocation=await this.allocate(tx,existing.loanId,id,newAmount); if(delta!==0) await tx.transaction.create({data:{customerId:existing.loan.customerId,type:delta>0?'LOAN_REPAYMENT_ADJUSTMENT':'LOAN_REPAYMENT_REVERSAL',amount:Math.abs(delta),description:`Repayment ${id} amount correction from ${oldAmount} to ${newAmount} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`}}); return {...repayment,...allocation};});}
  async remove(id:string,user:any){const existing=await this.findOne(id,user); return this.prisma.$transaction(async tx=>{const deleted=await tx.repayment.delete({where:{id}}); await tx.$executeRawUnsafe(`DELETE FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`,id); await tx.transaction.create({data:{customerId:existing.loan.customerId,type:'LOAN_REPAYMENT_REVERSAL',amount:Number(existing.amount),description:`Reversal of deleted loan repayment ${id} — Interest ₦${Number(existing.interestPaid||0).toFixed(2)} / Principal ₦${Number(existing.principalPaid||0).toFixed(2)}`}}); return deleted;});}
}
