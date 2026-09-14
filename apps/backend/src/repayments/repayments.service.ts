import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { UpdateRepaymentDto } from './dto/update-repayment.dto';

@Injectable()
export class RepaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private amount(value: unknown) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) {
      throw new BadRequestException('Repayment amount must be greater than zero');
    }
    return Math.round(n * 100) / 100;
  }

  private async ensureAllocationTable() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PWFBRepaymentAllocation" (
        "repaymentId" TEXT PRIMARY KEY,
        "principalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "interestPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async allocate(tx: any, loanId: string, repaymentId: string, amount: number) {
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    const interestAmount = Number(loan.amount || 0) * Number(loan.interestRate || 0) / 100;
    const prior = await tx.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM("interestPaid"),0) AS "interestPaid", COALESCE(SUM("principalPaid"),0) AS "principalPaid"
      FROM "PWFBRepaymentAllocation" a
      JOIN "Repayment" r ON r.id=a."repaymentId"
      WHERE r."loanId"=$1 AND r.id<>$2
    `, loanId, repaymentId);

    const priorInterest = Number(prior[0]?.interestPaid || 0);
    const priorPrincipal = Number(prior[0]?.principalPaid || 0);
    const interestRemaining = Math.max(0, interestAmount - priorInterest);
    const principalRemaining = Math.max(0, Number(loan.amount || 0) - priorPrincipal);

    // Standard amortisation allocation: interest is settled first, then principal.
    const interestPaid = Math.min(amount, interestRemaining);
    const principalPaid = Math.min(Math.max(0, amount - interestPaid), principalRemaining);
    const allocated = Math.round((interestPaid + principalPaid) * 100) / 100;
    if (allocated < Math.round(amount * 100) / 100) {
      throw new BadRequestException(`Repayment exceeds the outstanding loan balance. Outstanding: ₦${(interestRemaining + principalRemaining).toFixed(2)}`);
    }

    await tx.$executeRawUnsafe(`
      INSERT INTO "PWFBRepaymentAllocation" ("repaymentId","principalPaid","interestPaid","updatedAt")
      VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
      ON CONFLICT ("repaymentId") DO UPDATE SET "principalPaid"=$2,"interestPaid"=$3,"updatedAt"=CURRENT_TIMESTAMP
    `, repaymentId, principalPaid, interestPaid);

    return { principalPaid, interestPaid, principalOutstanding: Math.max(0, principalRemaining - principalPaid), interestOutstanding: Math.max(0, interestRemaining - interestPaid) };
  }

  async create(createRepaymentDto: CreateRepaymentDto) {
    const amount = this.amount(createRepaymentDto.amount);
    const loan = await this.prisma.loan.findUnique({ where: { id: createRepaymentDto.loanId } });
    if (!loan) throw new NotFoundException('Loan not found');

    await this.ensureAllocationTable();

    return this.prisma.$transaction(async (tx) => {
      const repayment = await tx.repayment.create({
        data: {
          loanId: createRepaymentDto.loanId,
          amount,
          paymentDate: createRepaymentDto.paymentDate ? new Date(createRepaymentDto.paymentDate) : undefined,
          method: createRepaymentDto.method,
          notes: createRepaymentDto.notes,
        },
        include: { loan: { include: { customer: true } } },
      });

      const allocation = await this.allocate(tx, loan.id, repayment.id, amount);

      await tx.transaction.create({
        data: {
          customerId: loan.customerId,
          type: 'LOAN_REPAYMENT',
          amount,
          description: `Loan repayment — ${loan.id}${createRepaymentDto.method ? ` — ${createRepaymentDto.method}` : ''} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`,
        },
      });

      return { ...repayment, ...allocation };
    });
  }

  async findAll() {
    await this.ensureAllocationTable();
    const rows = await this.prisma.repayment.findMany({ orderBy: { createdAt: 'desc' }, include: { loan: { include: { customer: true } } } });
    return Promise.all(rows.map(async (repayment) => {
      const allocation = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`, repayment.id);
      return { ...repayment, principalPaid: Number(allocation[0]?.principalPaid || 0), interestPaid: Number(allocation[0]?.interestPaid || 0) };
    }));
  }

  async findOne(id: string) {
    await this.ensureAllocationTable();
    const repayment = await this.prisma.repayment.findUnique({ where: { id }, include: { loan: { include: { customer: true } } } });
    if (!repayment) throw new NotFoundException('Repayment not found');
    const allocation = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "principalPaid","interestPaid" FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`, id);
    return { ...repayment, principalPaid: Number(allocation[0]?.principalPaid || 0), interestPaid: Number(allocation[0]?.interestPaid || 0) };
  }

  async update(id: string, updateRepaymentDto: UpdateRepaymentDto) {
    const existing = await this.findOne(id);
    if (updateRepaymentDto.loanId && updateRepaymentDto.loanId !== existing.loanId) {
      throw new BadRequestException('A repayment cannot be moved to another loan. Create a reversal and a new repayment instead.');
    }

    const newAmount = updateRepaymentDto.amount === undefined ? Number(existing.amount) : this.amount(updateRepaymentDto.amount);
    const oldAmount = Number(existing.amount);
    const delta = Math.round((newAmount - oldAmount) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      const repayment = await tx.repayment.update({
        where: { id },
        data: {
          amount: newAmount,
          paymentDate: updateRepaymentDto.paymentDate ? new Date(updateRepaymentDto.paymentDate) : undefined,
          method: updateRepaymentDto.method,
          notes: updateRepaymentDto.notes,
        },
        include: { loan: { include: { customer: true } } },
      });

      const allocation = await this.allocate(tx, existing.loanId, id, newAmount);
      if (delta !== 0) {
        await tx.transaction.create({
          data: {
            customerId: existing.loan.customerId,
            type: delta > 0 ? 'LOAN_REPAYMENT_ADJUSTMENT' : 'LOAN_REPAYMENT_REVERSAL',
            amount: Math.abs(delta),
            description: `Repayment ${id} amount correction from ${oldAmount} to ${newAmount} — Interest ₦${allocation.interestPaid.toFixed(2)} / Principal ₦${allocation.principalPaid.toFixed(2)}`,
          },
        });
      }
      return { ...repayment, ...allocation };
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.repayment.delete({ where: { id } });
      await tx.$executeRawUnsafe(`DELETE FROM "PWFBRepaymentAllocation" WHERE "repaymentId"=$1`, id);
      await tx.transaction.create({
        data: {
          customerId: existing.loan.customerId,
          type: 'LOAN_REPAYMENT_REVERSAL',
          amount: Number(existing.amount),
          description: `Reversal of deleted loan repayment ${id} — Interest ₦${Number(existing.interestPaid || 0).toFixed(2)} / Principal ₦${Number(existing.principalPaid || 0).toFixed(2)}`,
        },
      });
      return deleted;
    });
  }
}
