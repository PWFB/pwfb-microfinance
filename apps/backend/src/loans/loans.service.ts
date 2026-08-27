import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';

const LOAN_TYPES = ['Loan', 'Daily Loan', 'Weekly Loan', 'Individual Loan', 'Monthly Loan'];

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureLoanTables() {
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBLoanRate" ("id" TEXT PRIMARY KEY, "loanType" TEXT UNIQUE NOT NULL, "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0, "active" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PWFBLoanMeta" ("loanId" TEXT PRIMARY KEY, "loanType" TEXT, "duration" DOUBLE PRECISION, "repaymentFrequency" TEXT, "purpose" TEXT, "interestAmount" DOUBLE PRECISION, "totalRepayment" DOUBLE PRECISION, "installmentAmount" DOUBLE PRECISION, "passportPhoto" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    for (const type of LOAN_TYPES) {
      await this.prisma.$executeRawUnsafe(`INSERT INTO "PWFBLoanRate" ("id","loanType","interestRate") VALUES ($1,$2,0) ON CONFLICT ("loanType") DO NOTHING`, `rate_${type.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, type);
    }
  }

  private async meta(loanId: string) {
    await this.ensureLoanTables();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PWFBLoanMeta" WHERE "loanId" = $1 LIMIT 1`, loanId);
    return rows[0] ?? null;
  }

  private async withMeta<T extends { id: string; amount: number; interestRate: number | null; repayments?: { amount: number }[] }>(loan: T) {
    const meta = await this.meta(loan.id);
    const interestAmount = Number(meta?.interestAmount ?? (Number(loan.amount) * Number(loan.interestRate ?? 0) / 100));
    const totalRepayment = Number(meta?.totalRepayment ?? (Number(loan.amount) + interestAmount));
    const paidAmount = (loan.repayments ?? []).reduce((sum, r) => sum + Number(r.amount || 0), 0);
    return { ...loan, ...meta, interestAmount, totalRepayment, paidAmount, outstandingAmount: Math.max(0, totalRepayment - paidAmount) };
  }

  async getLoanRates() {
    await this.ensureLoanTables();
    return this.prisma.$queryRawUnsafe<any[]>(`SELECT "loanType", "interestRate", "active", "updatedAt" FROM "PWFBLoanRate" ORDER BY "loanType" ASC`);
  }

  async setLoanRate(loanType: string, interestRate: number) {
    if (!LOAN_TYPES.includes(loanType)) throw new NotFoundException('Unsupported loan type');
    if (!Number.isFinite(interestRate) || interestRate < 0) throw new Error('Interest rate must be a non-negative number');
    await this.ensureLoanTables();
    return this.prisma.$queryRawUnsafe<any[]>(`UPDATE "PWFBLoanRate" SET "interestRate" = $1, "active" = TRUE, "updatedAt" = CURRENT_TIMESTAMP WHERE "loanType" = $2 RETURNING "loanType", "interestRate", "active", "updatedAt"`, interestRate, loanType).then(r => r[0]);
  }

  async create(createLoanDto: CreateLoanDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: createLoanDto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    await this.ensureLoanTables();
    const loanType = createLoanDto.loanType || 'Loan';
    const rateRows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT "interestRate" FROM "PWFBLoanRate" WHERE "loanType" = $1 AND "active" = TRUE LIMIT 1`, loanType);
    const interestRate = Number(rateRows[0]?.interestRate ?? createLoanDto.interestRate ?? 0);
    const amount = Number(createLoanDto.amount || 0);
    const interestAmount = amount * interestRate / 100;
    const totalRepayment = amount + interestAmount;
    const duration = Number(createLoanDto.duration || 1);
    const installmentAmount = totalRepayment / Math.max(1, duration);
    const loan = await this.prisma.loan.create({
      data: {
        customerId: createLoanDto.customerId, amount, interestRate,
        status: createLoanDto.status ?? 'PENDING',
        disbursementAmount: createLoanDto.disbursementAmount,
        disbursementAccountNumber: createLoanDto.disbursementAccountNumber,
        disbursementAccountName: createLoanDto.disbursementAccountName,
        disbursementBankCode: createLoanDto.disbursementBankCode,
        disbursementBankName: createLoanDto.disbursementBankName,
        disbursementUsesAlternativeAccount: createLoanDto.disbursementUsesAlternativeAccount ?? false,
      }, include: { customer: true, repayments: true, guarantors: true },
    });
    await this.prisma.$executeRawUnsafe(`INSERT INTO "PWFBLoanMeta" ("loanId","loanType","duration","repaymentFrequency","purpose","interestAmount","totalRepayment","installmentAmount","passportPhoto") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, loan.id, loanType, duration, createLoanDto.repaymentFrequency ?? null, createLoanDto.purpose ?? null, interestAmount, totalRepayment, installmentAmount, createLoanDto.passportPhoto ?? null);
    return this.withMeta(loan);
  }

  async findAll() {
    const loans = await this.prisma.loan.findMany({ orderBy: { createdAt: 'desc' }, include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } } } }, repayments: true, guarantors: true } });
    return Promise.all(loans.map(l => this.withMeta(l)));
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id }, include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } } } }, repayments: true, guarantors: true } });
    if (!loan) throw new NotFoundException('Loan not found');
    return this.withMeta(loan);
  }

  async update(id: string, dto: UpdateLoanDto) {
    await this.findOne(id);
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    return this.prisma.loan.update({ where: { id }, data: { customerId: dto.customerId, amount: dto.amount, interestRate: dto.interestRate, status: dto.status, disbursementAmount: dto.disbursementAmount, disbursementAccountNumber: dto.disbursementAccountNumber, disbursementAccountName: dto.disbursementAccountName, disbursementBankCode: dto.disbursementBankCode, disbursementBankName: dto.disbursementBankName, disbursementUsesAlternativeAccount: dto.disbursementUsesAlternativeAccount }, include: { customer: true, repayments: true, guarantors: true } });
  }

  async remove(id: string) { await this.findOne(id); await this.ensureLoanTables(); await this.prisma.$executeRawUnsafe(`DELETE FROM "PWFBLoanMeta" WHERE "loanId" = $1`, id); return this.prisma.loan.delete({ where: { id } }); }

  async findGuarantors(loanId: string) { await this.findOne(loanId); return this.prisma.guarantor.findMany({ where: { loanId }, orderBy: { createdAt: 'desc' } }); }
  async addGuarantor(loanId: string, dto: CreateGuarantorDto) { await this.findOne(loanId); return this.prisma.guarantor.create({ data: { loanId, firstName: dto.firstName, middleName: dto.middleName, lastName: dto.lastName, phone: dto.phone, email: dto.email, address: dto.address, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, relationship: dto.relationship, idType: dto.idType, idNumber: dto.idNumber, idDocument: dto.idDocument, passportPhoto: dto.passportPhoto, temporaryVerified: false, verificationNote: dto.verificationNote ?? 'Temporary record only. Identity has not been externally verified.' } }); }
  async updateGuarantor(loanId: string, guarantorId: string, dto: Partial<CreateGuarantorDto>) { await this.findOne(loanId); const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } }); if (!existing) throw new NotFoundException('Guarantor not found'); return this.prisma.guarantor.update({ where: { id: guarantorId }, data: { firstName: dto.firstName, middleName: dto.middleName, lastName: dto.lastName, phone: dto.phone, email: dto.email, address: dto.address, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, relationship: dto.relationship, idType: dto.idType, idNumber: dto.idNumber, idDocument: dto.idDocument, passportPhoto: dto.passportPhoto, verificationNote: dto.verificationNote } }); }
  async removeGuarantor(loanId: string, guarantorId: string) { await this.findOne(loanId); const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } }); if (!existing) throw new NotFoundException('Guarantor not found'); return this.prisma.guarantor.delete({ where: { id: guarantorId } }); }
}
