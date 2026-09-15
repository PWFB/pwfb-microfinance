import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { AuditService } from '../audit/audit.service';

const MANAGERS = ['BRANCH_MANAGER','AREA_MANAGER','DIVISIONAL_MANAGER','REGIONAL_MANAGER','ADMIN','SUPER_ADMIN'];
const FINALIZERS = ['ADMIN','SUPER_ADMIN'];

@Injectable()
export class BranchClosingService {
  constructor(private readonly prisma: PrismaService, private readonly scope: AccessScopeService, private readonly audit: AuditService) {}

  private async branch(id: string) {
    const rows: any[] = await this.prisma.$queryRawUnsafe(`SELECT id,name,address,"regionId","divisionId","areaId" FROM "Branch" WHERE id=$1 LIMIT 1`, id);
    if (!rows[0]) throw new NotFoundException('Branch not found');
    return rows[0];
  }

  private async ensureTable() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "BranchClosing" ("id" text PRIMARY KEY,"branchId" text NOT NULL,"periodId" text NOT NULL,"closingDate" date NOT NULL,"status" text NOT NULL DEFAULT 'SUBMITTED',"submittedBy" text,"submittedAt" timestamptz NOT NULL DEFAULT NOW(),"approvedBy" text,"approvedAt" timestamptz,"checklist" jsonb NOT NULL DEFAULT '{}'::jsonb,"createdAt" timestamptz NOT NULL DEFAULT NOW(),"updatedAt" timestamptz NOT NULL DEFAULT NOW(), UNIQUE("branchId","periodId","closingDate"))`);
  }

  async checklist(user: any, branchId: string, periodId: string, closingDate: string) {
    await this.ensureTable();
    await this.scope.assertBranch(user, branchId);
    const branch = await this.branch(branchId);
    const date = new Date(`${closingDate}T23:59:59.999Z`);
    const start = new Date(`${closingDate}T00:00:00.000Z`);
    const [walletRows, collectionRows, unreconciledRows, cashRows, approvals] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count, COALESCE(SUM(balance),0)::float AS balance FROM staff_wallets WHERE branch_id=$1`, branchId),
      this.prisma.dailyCollection.aggregate({ where: { branchId, collectionDate: { gte: start, lte: date } }, _count: { id: true }, _sum: { amount: true } }),
      this.prisma.dailyCollection.aggregate({ where: { branchId, collectionDate: { gte: start, lte: date }, reconciled: false }, _count: { id: true }, _sum: { amount: true } }),
      this.prisma.cashbookEntry.groupBy({ by: ['type'], where: { branchId, entryDate: { gte: start, lte: date } }, _sum: { amount: true } }),
      this.prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS count FROM "Loan" l JOIN "Customer" c ON c.id=l."customerId" WHERE c."branchId"=$1 AND COALESCE(l.status,'') IN ('PENDING_APPROVAL','AWAITING_APPROVAL')`, branchId),
    ]);
    const cashIn = Number(cashRows.find((x:any)=>x.type==='CASH_IN')?._sum?.amount || 0);
    const cashOut = Number(cashRows.find((x:any)=>x.type==='CASH_OUT')?._sum?.amount || 0);
    const checklist = {
      staffWalletSettled: Number(walletRows[0]?.balance || 0) === 0,
      collectionsSettled: Number((await this.prisma.dailyCollection.count({ where: { branchId, collectionDate: { gte:start,lte:date }, settled:false } })) || 0) === 0,
      collectionsReconciled: Number(unreconciledRows._count.id || 0) === 0,
      cashbookReviewed: true,
      approvalsReviewed: Number(approvals[0]?.count || 0) === 0,
    };
    const blockers = Object.entries(checklist).filter(([,ok])=>!ok).map(([key])=>key);
    return { branch, periodId, closingDate, status: blockers.length ? 'REVIEW_REQUIRED' : 'READY', canSubmit: blockers.length===0, checklist, blockers, totals: { staffWalletBalance:Number(walletRows[0]?.balance||0), collections:Number(collectionRows._sum.amount||0), cashIn, cashOut, closingCash:cashIn-cashOut, unreconciledAmount:Number(unreconciledRows._sum.amount||0) } };
  }

  async submit(user:any, branchId:string, periodId:string, closingDate:string) {
    if (!MANAGERS.includes(String(user.role))) throw new ForbiddenException('Only authorized management can submit branch closing');
    const check = await this.checklist(user,branchId,periodId,closingDate);
    if (!check.canSubmit) throw new BadRequestException(`Branch closing blocked: ${check.blockers.join(', ')}`);
    await this.ensureTable();
    const id=randomUUID();
    try { await this.prisma.$executeRawUnsafe(`INSERT INTO "BranchClosing" ("id","branchId","periodId","closingDate","status","submittedBy","checklist") VALUES ($1,$2,$3,$4,'SUBMITTED',$5,$6::jsonb)`,id,branchId,periodId,closingDate,user.id||null,JSON.stringify(check)); }
    catch { throw new BadRequestException('A branch closing already exists for this date and period'); }
    await this.audit.record({actorId:user.id,actorEmail:user.email,actorRole:user.role,action:'BRANCH_CLOSING_SUBMITTED',method:'POST',resource:'BranchClosing',recordId:id,details:{branchId,periodId,closingDate}});
    return { id,status:'SUBMITTED',message:'Branch closing submitted for final approval.' };
  }

  async approve(user:any,id:string) {
    if (!FINALIZERS.includes(String(user.role))) throw new ForbiddenException('Only Admin or Super Admin can finalize branch closing');
    await this.ensureTable();
    const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT * FROM "BranchClosing" WHERE id=$1 LIMIT 1`,id);
    if(!rows[0]) throw new NotFoundException('Branch closing not found');
    if(rows[0].status!=='SUBMITTED') throw new BadRequestException('Branch closing is not awaiting approval');
    await this.prisma.$executeRawUnsafe(`UPDATE "BranchClosing" SET status='CLOSED',"approvedBy"=$1,"approvedAt"=NOW(),"updatedAt"=NOW() WHERE id=$2`,user.id||null,id);
    await this.audit.record({actorId:user.id,actorEmail:user.email,actorRole:user.role,action:'BRANCH_CLOSING_APPROVED',method:'POST',resource:'BranchClosing',recordId:id,details:{branchId:rows[0].branchId,periodId:rows[0].periodId,closingDate:rows[0].closingDate}});
    return { id,status:'CLOSED',message:'Branch closing finalized.' };
  }

  async list(user:any, periodId?:string) {
    await this.ensureTable();
    const access=await this.scope.getScope(user);
    const values:any[]=[]; let where='';
    if(periodId){values.push(periodId);where=' WHERE "periodId"=$1';}
    const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT bc.*,b.name AS "branchName" FROM "BranchClosing" bc JOIN "Branch" b ON b.id=bc."branchId"${where} ORDER BY bc."closingDate" DESC,bc."createdAt" DESC`,...values);
    if(access.global) return rows;
    return rows.filter(r => r.branchId===access.branchId);
  }
}
