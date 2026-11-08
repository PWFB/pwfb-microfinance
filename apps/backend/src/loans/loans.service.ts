import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';
import { AccessScopeService } from '../access/access-scope.service';
const LOAN_TYPES = ['Loan','Daily Loan','Weekly Loan','Individual Loan','Monthly Loan'];
@Injectable()
export class LoansService {
 constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}
 private async ensureLoanTables(){
  await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBLoanRate" ("id" TEXT PRIMARY KEY, "loanType" TEXT UNIQUE NOT NULL, "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBLoanMeta" ("loanId" TEXT PRIMARY KEY, "loanType" TEXT, "duration" DOUBLE PRECISION, "repaymentFrequency" TEXT, "purpose" TEXT, "interestAmount" DOUBLE PRECISION, "totalRepayment" DOUBLE PRECISION, "installmentAmount" DOUBLE PRECISION, "passportPhoto" TEXT, "disbursementDestination" TEXT, "verifiedNameMatchCount" DOUBLE PRECISION, "disbursementAccountVerified" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" ("repaymentId" TEXT PRIMARY KEY,"principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "disbursementDestination" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "verifiedNameMatchCount" DOUBLE PRECISION`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "disbursementAccountVerified" BOOLEAN NOT NULL DEFAULT FALSE`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "borrowerType" TEXT NOT NULL DEFAULT 'INDIVIDUAL'`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "groupId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "registeredStaffId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "creatorUserId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "assetReviewStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED'`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "assetReviewedByStaffId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "assetReviewedByUserId" TEXT`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "assetReviewedAt" TIMESTAMP`);
  await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "assetReviewNote" TEXT`);
  await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBLoanReviewEvent" ("id" TEXT PRIMARY KEY,"loanId" TEXT NOT NULL REFERENCES "Loan"("id") ON DELETE RESTRICT,"actorUserId" TEXT NOT NULL,"actorStaffId" TEXT NOT NULL,"action" TEXT NOT NULL,"note" TEXT,"createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PWFBLoanReviewEvent_loanId_createdAt_idx" ON "PWFBLoanReviewEvent" ("loanId","createdAt")`);
  for(const type of LOAN_TYPES) await this.prisma.$executeRawUnsafe(`INSERT INTO "PWFBLoanRate" ("id","loanType","interestRate") VALUES ($1,$2,0) ON CONFLICT ("loanType") DO NOTHING`,`rate_${type.toLowerCase().replace(/[^a-z0-9]+/g,'_')}`,type);
 }
 private async meta(id:string){await this.ensureLoanTables();const rows=await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,id);return rows[0]??null;}
 private async withMeta<T extends {id:string;amount:number;interestRate:number|null;repayments?:{amount:number}[]}>(loan:T){
  const meta=await this.meta(loan.id);
  const interestAmount=Number(meta?.interestAmount??(Number(loan.amount)*Number(loan.interestRate??0)/100));
  const totalRepayment=Number(meta?.totalRepayment??(Number(loan.amount)+interestAmount));
  const paidAmount=(loan.repayments??[]).reduce((s,r)=>s+Number(r.amount||0),0);
  const allocationRows=await this.prisma.$queryRawUnsafe<any[]>(`SELECT COALESCE(SUM("principalPaid"),0) AS "principalPaid",COALESCE(SUM("interestPaid"),0) AS "interestPaid" FROM "PWFBRepaymentAllocation" a JOIN "Repayment" r ON r.id=a."repaymentId" WHERE r."loanId"=$1`,loan.id);
  const principalPaid=Number(allocationRows[0]?.principalPaid||0);
  const interestPaid=Number(allocationRows[0]?.interestPaid||0);
  const principalOutstanding=Math.max(0,Number(loan.amount)-principalPaid);
  const interestOutstanding=Math.max(0,interestAmount-interestPaid);
  return {...loan,...meta,interestAmount,totalRepayment,paidAmount,principalPaid,interestPaid,principalOutstanding,interestOutstanding,outstandingAmount:Math.max(0,totalRepayment-paidAmount)};
 }
 async getCustomerName(customerId:string){const customer=await this.prisma.customer.findUnique({where:{id:customerId}});if(!customer)throw new NotFoundException('Customer not found');return [customer.firstName,customer.middleName,customer.lastName].filter(Boolean).join(' ').trim();}
 async getLoanRates(){await this.ensureLoanTables();return this.prisma.$queryRawUnsafe<any[]>(`SELECT "loanType","interestRate","active","updatedAt" FROM "PWFBLoanRate" ORDER BY "loanType" ASC`);}
 async setLoanRate(loanType:string,interestRate:number){if(!LOAN_TYPES.includes(loanType))throw new NotFoundException('Unsupported loan type');if(!Number.isFinite(interestRate)||interestRate<0)throw new Error('Interest rate must be a non-negative number');await this.ensureLoanTables();const rows=await this.prisma.$queryRawUnsafe<any[]>(`UPDATE "PWFBLoanRate" SET "interestRate"=$1,"active"=TRUE,"updatedAt"=CURRENT_TIMESTAMP WHERE "loanType"=$2 RETURNING "loanType","interestRate","active","updatedAt"`,interestRate,loanType);return rows[0];}
 async listRegisteredStaffBorrowers(user: any) {
  const scope = await this.accessScope.getScope(user);
  const branchIds = scope.global ? null : await this.accessScope.getBranchIds(user);
  if (!scope.global && !branchIds?.length) return [];
  if (['CREDIT_OFFICER','TELLER'].includes(scope.role) && !scope.staffId) return [];
  const whereParts = ['s."employmentStatus" = \'ACTIVE\'', 'c."id" IS NOT NULL'];
  const params: any[] = [];
  if (!scope.global) {
    params.push(branchIds);
    whereParts.push('s."branchId" = ANY($' + params.length + '::text[])');
  }
  if (scope.role === 'CREDIT_OFFICER' || scope.role === 'TELLER') {
    params.push(scope.staffId);
    whereParts.push('c."assignedStaffId" = $' + params.length);
  }
  return this.prisma.$queryRawUnsafe<any[]>(
    'SELECT s."id" AS "registeredStaffId", s."staffId", s."firstName", s."lastName", s."branchId", c."id" AS "customerId", c."groupId" FROM "Staff" s JOIN "User" u ON u."id"=s."userId" LEFT JOIN LATERAL (SELECT c0."id", c0."groupId", c0."assignedStaffId" FROM "Customer" c0 WHERE c0."id"=u."customerId" OR c0."userId"=u."id" ORDER BY CASE WHEN c0."id"=u."customerId" THEN 0 ELSE 1 END LIMIT 1) c ON TRUE WHERE ' + whereParts.join(' AND ') + ' ORDER BY s."lastName", s."firstName"',
    ...params,
  );
 }

 async create(dto: CreateLoanDto, user: any) {
  const borrowerType = String(dto.borrowerType || 'INDIVIDUAL').toUpperCase();
  if (!['INDIVIDUAL', 'GROUP', 'STAFF'].includes(borrowerType)) throw new BadRequestException('Select an individual, group or registered-staff borrower');
  const scope = await this.accessScope.getScope(user);
  const branchIds = scope.global ? null : await this.accessScope.getBranchIds(user);
  if (!scope.global && !branchIds?.length) throw new BadRequestException('Your account has no assigned branch or organizational scope');

  let customerId = String(dto.customerId || '').trim();
  let registeredStaffId: string | null = null;
  if (borrowerType === 'STAFF') {
    registeredStaffId = String(dto.registeredStaffId || '').trim();
    if (!registeredStaffId) throw new BadRequestException('Select a registered staff borrower');
    const staff = await this.prisma.staff.findUnique({
      where: { id: registeredStaffId },
      include: { user: { select: { id: true, customerId: true } } },
    });
    if (!staff || staff.employmentStatus !== 'ACTIVE' || !staff.user) throw new NotFoundException('Active registered staff member not found');
    const linkedCustomer = staff.user.customerId
      ? await this.prisma.customer.findUnique({ where: { id: staff.user.customerId } })
      : await this.prisma.customer.findFirst({ where: { userId: staff.user.id } });
    if (!linkedCustomer) throw new BadRequestException('The selected staff member must first have a registered customer financial profile');
    if (customerId && customerId !== linkedCustomer.id) throw new BadRequestException('The staff borrower does not match the selected customer profile');
    customerId = linkedCustomer.id;
    if (staff.branchId !== linkedCustomer.branchId) throw new BadRequestException('Staff and customer financial profile must belong to the same branch');
  }

  const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new NotFoundException('Customer not found');
  await this.accessScope.assertCustomer(user, customer.id);
  const actorStaffId = String(scope.staffId || '').trim() || null;

  if (borrowerType === 'GROUP') {
    const groupId = String(dto.groupId || '').trim();
    if (!groupId || customer.groupId !== groupId) throw new BadRequestException('Select a customer who is a member of the chosen group');
    const group = await this.prisma.clientGroup.findUnique({ where: { id: groupId } });
    if (!group || group.branchId !== customer.branchId) throw new BadRequestException('The selected group does not belong to the borrower branch');
    if (scope.role === 'CREDIT_OFFICER' || scope.role === 'TELLER') {
      if (!actorStaffId || customer.assignedStaffId !== actorStaffId) throw new BadRequestException('Credit officers can select only their own group members');
      await this.prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "PWFBClientGroupOwner" ("groupId" TEXT PRIMARY KEY REFERENCES "ClientGroup"("id") ON DELETE CASCADE, "ownerStaffId" TEXT NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)');
      const owners = await this.prisma.$queryRawUnsafe<Array<{ ownerStaffId: string }>>('SELECT "ownerStaffId" FROM "PWFBClientGroupOwner" WHERE "groupId"=$1 LIMIT 1', groupId);
      if (!owners.length || owners[0].ownerStaffId !== actorStaffId) throw new BadRequestException('This group belongs to another credit officer');
    }
  } else if (borrowerType === 'INDIVIDUAL' && dto.groupId) {
    throw new BadRequestException('Choose Group borrower type when selecting a client group');
  }

  if (borrowerType === 'STAFF' && registeredStaffId) {
    const staff = await this.prisma.staff.findUnique({ where: { id: registeredStaffId }, select: { branchId: true } });
    if (!staff || staff.branchId !== customer.branchId) throw new BadRequestException('Registered staff borrower must belong to the selected customer branch');
  }

  await this.ensureLoanTables();
  const loanType = dto.loanType || 'Loan';
  const destination = dto.disbursementDestination || 'WALLET';
  if (destination === 'BANK' && (!dto.disbursementBankCode || !dto.disbursementAccountNumber || !dto.disbursementAccountName || dto.disbursementAccountVerified !== true || Number(dto.verifiedNameMatchCount || 0) < 2)) {
    throw new BadRequestException('Bank account must be verified with at least two matching names before loan submission');
  }
  const rates = await this.prisma.$queryRawUnsafe<any[]>('SELECT "interestRate" FROM "PWFBLoanRate" WHERE "loanType"=$1 AND "active"=TRUE LIMIT 1', loanType);
  const configuredRate = rates[0]?.interestRate === undefined ? undefined : Number(rates[0].interestRate);
  const interestRate = dto.interestRate !== undefined ? Number(dto.interestRate) : Number(configuredRate ?? 0);
  if (!Number.isFinite(interestRate) || interestRate < 0) throw new BadRequestException('A valid non-negative interest rate is required');
  const amount = Number(dto.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Loan principal must be greater than zero');
  const interestAmount = amount * interestRate / 100;
  const totalRepayment = amount + interestAmount;
  const duration = Math.max(1, Number(dto.duration || 1));
  if (!Number.isFinite(duration)) throw new BadRequestException('Loan duration must be valid');
  const installmentAmount = totalRepayment / duration;

  const loan = await this.prisma.$transaction(async tx => {
    const created = await tx.loan.create({
      data: {
        customerId,
        amount,
        interestRate,
        status: 'PENDING',
        disbursementAmount: dto.disbursementAmount,
        disbursementAccountNumber: destination === 'BANK' ? dto.disbursementAccountNumber : null,
        disbursementAccountName: destination === 'BANK' ? dto.disbursementAccountName : null,
        disbursementBankCode: destination === 'BANK' ? dto.disbursementBankCode : null,
        disbursementBankName: destination === 'BANK' ? dto.disbursementBankName : null,
        disbursementUsesAlternativeAccount: destination === 'BANK',
      },
      include: { customer: true, repayments: true, guarantors: true },
    });
    await tx.$executeRawUnsafe(
      'INSERT INTO "PWFBLoanMeta" ("loanId","loanType","duration","repaymentFrequency","purpose","interestAmount","totalRepayment","installmentAmount","passportPhoto","disbursementDestination","verifiedNameMatchCount","disbursementAccountVerified","borrowerType","groupId","registeredStaffId","createdByStaffId","creatorUserId","assetReviewStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)',
      created.id, loanType, duration, dto.repaymentFrequency ?? null, dto.purpose ?? null,
      interestAmount, totalRepayment, installmentAmount, dto.passportPhoto ?? null, destination,
      dto.verifiedNameMatchCount ?? 0, destination === 'BANK' && dto.disbursementAccountVerified === true,
      borrowerType, borrowerType === 'GROUP' ? dto.groupId : null, registeredStaffId, actorStaffId, user?.id || null,
      loanType === 'Individual Loan' ? 'PENDING_ASSET_REVIEW' : 'NOT_REQUIRED',
    );
    return created;
  });
  return this.withMeta(loan);
 }
 async getRepaymentSchedule(id:string,user:any){
  const loan=await this.findOne(id,user);
  const duration=Math.max(1,Math.ceil(Number(loan.duration||1)));
  const frequency=String(loan.repaymentFrequency||'Monthly').toLowerCase();
  const total=Number(loan.totalRepayment||0);
  const principal=Number(loan.amount||0);
  const interest=Number(loan.interestAmount||0);
  const start=new Date(loan.createdAt||new Date());
  const intervalDays=frequency.includes('daily')?1:frequency.includes('weekly')?7:30;
  const baseInstallment=Math.round((total/duration)*100)/100;
  const repayments=Array.isArray(loan.repayments)?loan.repayments:[];
  let cumulativePaid=0;
  const schedule=Array.from({length:duration},(_,index)=>{
    const installment=index===duration-1?Math.round((total-baseInstallment*(duration-1))*100)/100:baseInstallment;
    const dueDate=new Date(start);
    dueDate.setDate(dueDate.getDate()+intervalDays*(index+1));
    cumulativePaid+=Number(repayments.filter((r:any)=>new Date(r.paymentDate||r.createdAt)<=dueDate).reduce((s:number,r:any)=>s+Number(r.amount||0),0));
    const expectedBefore=Math.round((baseInstallment*index)*100)/100;
    const paidForPeriod=Math.min(installment,Math.max(0,cumulativePaid-expectedBefore));
    const remaining=Math.max(0,installment-paidForPeriod);
    const status=remaining<=0.005?'PAID':new Date()>=dueDate?'OVERDUE':'DUE';
    return {installmentNumber:index+1,dueDate:dueDate.toISOString(),amount:installment,principalAmount:Math.round((principal/duration)*100)/100,interestAmount:Math.round((interest/duration)*100)/100,paidAmount:Math.round(paidForPeriod*100)/100,remainingAmount:Math.round(remaining*100)/100,status};
  });
  return {loanId:loan.id,loanType:loan.loanType||'Loan',frequency:loan.repaymentFrequency||'Monthly',duration,totalRepayment:total,principal,interestAmount:interest,installmentAmount:baseInstallment,startDate:start.toISOString(),schedule};
 }
 async findAll(user: any) {
  const scope = await this.accessScope.getScope(user);
  const branchIds = scope.global ? null : await this.accessScope.getBranchIds(user);
  if (!scope.global && !branchIds?.length) return [];
  const customerWhere = scope.global ? {} : ['CREDIT_OFFICER', 'TELLER'].includes(scope.role)
    ? { branchId: { in: branchIds! }, assignedStaffId: scope.staffId || '__NO_STAFF__' }
    : { branchId: { in: branchIds! } };
  const loans = await this.prisma.loan.findMany({
    where: scope.global ? {} : { customer: { is: customerWhere } },
    orderBy: { createdAt: 'desc' },
    include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } }, clientGroup: true, assignedStaff: true } }, repayments: true, guarantors: true },
  });
  return Promise.all(loans.map(loan => this.withMeta(loan)));
 }

 async findOne(id: string, user: any) {
  const loan = await this.prisma.loan.findUnique({
    where: { id },
    include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } }, clientGroup: true, assignedStaff: true } }, repayments: true, guarantors: true },
  });
  if (!loan) throw new NotFoundException('Loan not found');
  if (user) await this.accessScope.assertLoan(user, id);
  return this.withMeta(loan);
 }
 async update(id:string,dto:UpdateLoanDto,user:any){const existing=await this.findOne(id,user);if(existing.status!=='PENDING')throw new BadRequestException('Only pending loan applications can be corrected before branch review');if(dto.customerId&&dto.customerId!==existing.customerId)throw new BadRequestException('Loan customer ownership cannot be changed after creation');if(dto.customerId){const customer=await this.prisma.customer.findUnique({where:{id:dto.customerId}});if(!customer)throw new NotFoundException('Customer not found');}const updated=await this.prisma.loan.update({where:{id},data:{customerId:dto.customerId,amount:dto.amount,interestRate:dto.interestRate,status:dto.status,disbursementAmount:dto.disbursementAmount,disbursementAccountNumber:dto.disbursementAccountNumber,disbursementAccountName:dto.disbursementAccountName,disbursementBankCode:dto.disbursementBankCode,disbursementBankName:dto.disbursementBankName,disbursementUsesAlternativeAccount:dto.disbursementUsesAlternativeAccount},include:{customer:true,repayments:true,guarantors:true}});await this.ensureLoanTables();const oldMeta=await this.meta(id);const amount=Number(updated.amount||0);const rate=Number(updated.interestRate??oldMeta?.interestRate??0);const interestAmount=amount*rate/100;const totalRepayment=amount+interestAmount;const duration=Math.max(1,Number(dto.duration??oldMeta?.duration??1));await this.prisma.$executeRawUnsafe(`INSERT INTO "PWFBLoanMeta" ("loanId","loanType","duration","repaymentFrequency","purpose","interestAmount","totalRepayment","installmentAmount","passportPhoto","disbursementDestination","verifiedNameMatchCount","disbursementAccountVerified") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT ("loanId") DO UPDATE SET "loanType"=COALESCE($2,"PWFBLoanMeta"."loanType"),"duration"=$3,"repaymentFrequency"=COALESCE($4,"PWFBLoanMeta"."repaymentFrequency"),"purpose"=COALESCE($5,"PWFBLoanMeta"."purpose"),"interestAmount"=$6,"totalRepayment"=$7,"installmentAmount"=$8,"passportPhoto"=COALESCE($9,"PWFBLoanMeta"."passportPhoto"),"disbursementDestination"=COALESCE($10,"PWFBLoanMeta"."disbursementDestination"),"verifiedNameMatchCount"=COALESCE($11,"PWFBLoanMeta"."verifiedNameMatchCount"),"disbursementAccountVerified"=COALESCE($12,"PWFBLoanMeta"."disbursementAccountVerified"),"updatedAt"=CURRENT_TIMESTAMP`,id,dto.loanType??oldMeta?.loanType??'Loan',duration,dto.repaymentFrequency??null,dto.purpose??null,interestAmount,totalRepayment,totalRepayment/duration,dto.passportPhoto??null,oldMeta?.disbursementDestination??'WALLET',oldMeta?.verifiedNameMatchCount??0,oldMeta?.disbursementAccountVerified??false);return this.withMeta(updated);}
 async remove(id:string,user:any){const existing=await this.findOne(id,user);if(existing.status!=='PENDING'||(existing.repayments||[]).length)throw new BadRequestException('A loan with a review status or financial history cannot be deleted');await this.ensureLoanTables();await this.prisma.$executeRawUnsafe(`DELETE FROM "PWFBLoanMeta" WHERE "loanId"=$1`,id);return this.prisma.loan.delete({where:{id}});}
 async findGuarantors(loanId:string,user:any){await this.findOne(loanId,user);return this.prisma.guarantor.findMany({where:{loanId},orderBy:{createdAt:'desc'}});}
 async addGuarantor(loanId:string,dto:CreateGuarantorDto,user:any){const loan=await this.findOne(loanId,user);if(loan.status!=='PENDING'&&loan.status!=='APPROVED')throw new BadRequestException('Guarantors cannot be added after disbursement review has started');return this.prisma.guarantor.create({data:{loanId,firstName:dto.firstName,middleName:dto.middleName,lastName:dto.lastName,phone:dto.phone,email:dto.email,address:dto.address,dateOfBirth:dto.dateOfBirth?new Date(dto.dateOfBirth):undefined,relationship:dto.relationship,idType:dto.idType,idNumber:dto.idNumber,idDocument:dto.idDocument,passportPhoto:dto.passportPhoto,temporaryVerified:false,verificationNote:dto.verificationNote??'Temporary record only. Identity has not been externally verified.'}});}
 async updateGuarantor(loanId:string,guarantorId:string,dto:Partial<CreateGuarantorDto>,user:any){const loan=await this.findOne(loanId,user);if(loan.status!=='PENDING')throw new BadRequestException('Guarantors cannot be edited after branch review starts');const existing=await this.prisma.guarantor.findFirst({where:{id:guarantorId,loanId}});if(!existing)throw new NotFoundException('Guarantor not found');return this.prisma.guarantor.update({where:{id:guarantorId},data:{firstName:dto.firstName,middleName:dto.middleName,lastName:dto.lastName,phone:dto.phone,email:dto.email,address:dto.address,dateOfBirth:dto.dateOfBirth?new Date(dto.dateOfBirth):undefined,relationship:dto.relationship,idType:dto.idType,idNumber:dto.idNumber,idDocument:dto.idDocument,passportPhoto:dto.passportPhoto,verificationNote:dto.verificationNote}});}
 async removeGuarantor(loanId:string,guarantorId:string,user:any){const loan=await this.findOne(loanId,user);if(loan.status!=='PENDING')throw new BadRequestException('Guarantors cannot be removed after branch review starts');const existing=await this.prisma.guarantor.findFirst({where:{id:guarantorId,loanId}});if(!existing)throw new NotFoundException('Guarantor not found');return this.prisma.guarantor.delete({where:{id:guarantorId}});}
}
