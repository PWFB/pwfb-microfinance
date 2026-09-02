import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type CashbookDailyInput = {
  periodId: string; branchId: string; entryDate?: string; description?: string;
  previousCashAtHand?: number; dailyCashInHand?: number; savingsDeposits?: number;
  dailyInstallmentCollection?: number; monthlyCollection?: number; memberRegistration?: number;
  riskPremium?: number; passbookSales?: number; loanDisbursement?: number; bankDeposit?: number;
  savingsWithdrawal?: number; savingsReturnedAdjustment?: number; fundTransfer?: number; other?: number;
  narration?: string; referenceNo?: string;
};

const FIELDS = [
  'previousCashAtHand','dailyCashInHand','savingsDeposits','dailyInstallmentCollection','monthlyCollection',
  'memberRegistration','riskPremium','passbookSales','loanDisbursement','bankDeposit','savingsWithdrawal',
  'savingsReturnedAdjustment','fundTransfer','other',
] as const;
const snake = (s: string) => s.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`);

@Injectable()
export class CashbookService {
  private ready: Promise<void> | null = null;
  constructor(private readonly prisma: PrismaService) {}

  private money(value: unknown) { const n=Number(value ?? 0); if(!Number.isFinite(n)||n<0) throw new BadRequestException('Cashbook amounts must be zero or greater'); return n; }
  private async ensureDailyTable() {
    if(!this.ready) this.ready=this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS cashbook_daily_records (
        id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES "FinancialPeriod"(id), branch_id TEXT NOT NULL REFERENCES "Branch"(id),
        entry_date TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, description TEXT,
        previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0, daily_cash_in_hand DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0, daily_installment_collection DOUBLE PRECISION NOT NULL DEFAULT 0,
        monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0, member_registration DOUBLE PRECISION NOT NULL DEFAULT 0,
        risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0, passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0,
        loan_disbursement DOUBLE PRECISION NOT NULL DEFAULT 0, bank_deposit DOUBLE PRECISION NOT NULL DEFAULT 0,
        savings_withdrawal DOUBLE PRECISION NOT NULL DEFAULT 0, savings_returned_adjustment DOUBLE PRECISION NOT NULL DEFAULT 0,
        fund_transfer DOUBLE PRECISION NOT NULL DEFAULT 0, other DOUBLE PRECISION NOT NULL DEFAULT 0,
        narration TEXT, reference_no TEXT, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS previous_cash_at_hand DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_cash_in_hand DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_deposits DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS daily_installment_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS monthly_collection DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS member_registration DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS risk_premium DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS passbook_sales DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS loan_disbursement DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_withdrawal DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS savings_returned_adjustment DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS fund_transfer DOUBLE PRECISION NOT NULL DEFAULT 0;
      ALTER TABLE cashbook_daily_records ADD COLUMN IF NOT EXISTS other DOUBLE PRECISION NOT NULL DEFAULT 0;
    `).then(()=>undefined).catch(e=>{this.ready=null;throw e;});
    await this.ready;
  }
  private values(data: CashbookDailyInput) { const v:any={}; for(const f of FIELDS)v[f]=this.money(data[f]); return v; }
  async create(data:any){
    const p=await this.prisma.financialPeriod.findUnique({where:{id:data.periodId}}); if(!p)throw new NotFoundException('Financial period not found'); if(p.status==='CLOSED')throw new BadRequestException('Cannot add cashbook entries to a closed period');
    const b=await this.prisma.branch.findUnique({where:{id:data.branchId}}); if(!b)throw new NotFoundException('Branch not found'); const amount=this.money(data.amount); if(amount<=0)throw new BadRequestException('Amount must be greater than zero');
    return this.prisma.cashbookEntry.create({data:{periodId:data.periodId,branchId:data.branchId,type:data.type,amount,reference:data.reference,description:data.description,entryDate:data.entryDate?new Date(data.entryDate):new Date()},include:{period:true,branch:true}});
  }
  async findAll(periodId?:string,branchId?:string){return this.prisma.cashbookEntry.findMany({where:{...(periodId?{periodId}:{}),...(branchId?{branchId}:{})},orderBy:{entryDate:'desc'},include:{period:true,branch:true}})}
  async findOne(id:string){const e=await this.prisma.cashbookEntry.findUnique({where:{id},include:{period:true,branch:true}});if(!e)throw new NotFoundException('Cashbook entry not found');return e;}
  async summary(periodId?:string,branchId?:string){const rows=await this.prisma.cashbookEntry.findMany({where:{...(periodId?{periodId}:{}),...(branchId?{branchId}:{})}});const cashIn=rows.filter(r=>r.type==='CASH_IN').reduce((s,r)=>s+r.amount,0),cashOut=rows.filter(r=>r.type==='CASH_OUT').reduce((s,r)=>s+r.amount,0);return{cashIn,cashOut,balance:cashIn-cashOut,entryCount:rows.length};}
  private map(r:any){const out:any={id:r.id,periodId:r.period_id,branchId:r.branch_id,entryDate:r.entry_date,description:r.description,narration:r.narration,referenceNo:r.reference_no,branch:{name:r.branch_name},period:{name:r.period_name}};for(const f of FIELDS)out[f]=Number(r[snake(f)]||0);out.totalAmount=FIELDS.reduce((s,f)=>s+out[f],0);return out;}
  async createDaily(data:CashbookDailyInput){
    await this.ensureDailyTable(); const p=await this.prisma.financialPeriod.findUnique({where:{id:data.periodId}});if(!p)throw new NotFoundException('Financial period not found');if(p.status==='CLOSED')throw new BadRequestException('Cannot add entries to a closed period');
    const b=await this.prisma.branch.findUnique({where:{id:data.branchId}});if(!b)throw new NotFoundException('Branch not found'); const v=this.values(data),id=randomUUID();
    const cols=FIELDS.map(snake); const placeholders=cols.map((_,i)=>`$${i+6}`); const params:any[]=[id,data.periodId,data.branchId,data.entryDate?new Date(data.entryDate):new Date(),data.description??null,...FIELDS.map(f=>v[f]),data.narration??null,data.referenceNo??null];
    await this.prisma.$executeRawUnsafe(`INSERT INTO cashbook_daily_records (id,period_id,branch_id,entry_date,description,${cols.join(',')},narration,reference_no) VALUES ($1,$2,$3,$4,$5,${placeholders.join(',')},$${params.length-1},$${params.length})`,...params); return this.dailyOne(id);
  }
  async dailyOne(id:string){await this.ensureDailyTable();const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT r.*,b.name AS branch_name,p.name AS period_name FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id WHERE r.id=$1`,id);if(!rows[0])throw new NotFoundException('Daily cashbook record not found');return this.map(rows[0]);}
  async findDaily(periodId?:string,branchId?:string,from?:string,to?:string){await this.ensureDailyTable();const c:string[]=[],p:any[]=[];if(periodId){p.push(periodId);c.push(`r.period_id=$${p.length}`)}if(branchId){p.push(branchId);c.push(`r.branch_id=$${p.length}`)}if(from){p.push(new Date(from));c.push(`r.entry_date>=$${p.length}`)}if(to){p.push(new Date(to));c.push(`r.entry_date<$${p.length}`)}const rows:any[]=await this.prisma.$queryRawUnsafe(`SELECT r.*,b.name AS branch_name,p.name AS period_name FROM cashbook_daily_records r JOIN "Branch" b ON b.id=r.branch_id JOIN "FinancialPeriod" p ON p.id=r.period_id ${c.length?'WHERE '+c.join(' AND '):''} ORDER BY r.entry_date DESC,r.created_at DESC`,...p);return rows.map(r=>this.map(r));}
  async dailySummary(periodId?:string,branchId?:string,from?:string,to?:string){const rows=await this.findDaily(periodId,branchId,from,to),totals:any={records:rows.length,totalAmount:0};for(const f of FIELDS)totals[f]=rows.reduce((s,r)=>s+Number(r[f]||0),0);totals.totalAmount=rows.reduce((s,r)=>s+Number(r.totalAmount||0),0);return totals;}
  async updateDaily(id:string,data:Partial<CashbookDailyInput>){const e=await this.dailyOne(id),m:any={...e,...data,periodId:data.periodId??e.periodId,branchId:data.branchId??e.branchId};const p=await this.prisma.financialPeriod.findUnique({where:{id:m.periodId}});if(!p)throw new NotFoundException('Financial period not found');if(p.status==='CLOSED')throw new BadRequestException('Cannot edit entries in a closed period');const v=this.values(m),sets=['period_id=$2','branch_id=$3','entry_date=$4','description=$5'],params:any[]=[id,m.periodId,m.branchId,m.entryDate?new Date(m.entryDate):new Date(),m.description??null];for(const f of FIELDS){params.push(v[f]);sets.push(`${snake(f)}=$${params.length}`)}params.push(m.narration??null,m.referenceNo??null);sets.push(`narration=$${params.length-1}`,`reference_no=$${params.length}`);await this.prisma.$executeRawUnsafe(`UPDATE cashbook_daily_records SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=$1`,...params);return this.dailyOne(id);}
  async removeDaily(id:string){const e=await this.dailyOne(id),p=await this.prisma.financialPeriod.findUnique({where:{id:e.periodId}});if(p?.status==='CLOSED')throw new BadRequestException('Cannot delete an entry from a closed period');await this.prisma.$executeRawUnsafe('DELETE FROM cashbook_daily_records WHERE id=$1',id);return{message:'Daily cashbook record deleted successfully'};}
  async remove(id:string){const e=await this.findOne(id);if(e.period.status==='CLOSED')throw new BadRequestException('Cannot delete an entry from a closed period');await this.prisma.cashbookEntry.delete({where:{id}});return{message:'Cashbook entry deleted successfully'};}
}
