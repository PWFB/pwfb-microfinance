import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLoanDto: CreateLoanDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: createLoanDto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.loan.create({
      data: {
        customerId: createLoanDto.customerId,
        amount: createLoanDto.amount,
        interestRate: createLoanDto.interestRate,
        status: createLoanDto.status ?? 'PENDING',
        disbursementAmount: createLoanDto.disbursementAmount,
        disbursementAccountNumber: createLoanDto.disbursementAccountNumber,
        disbursementAccountName: createLoanDto.disbursementAccountName,
        disbursementBankCode: createLoanDto.disbursementBankCode,
        disbursementBankName: createLoanDto.disbursementBankName,
        disbursementUsesAlternativeAccount: createLoanDto.disbursementUsesAlternativeAccount ?? false,
      },
      include: { customer: true, repayments: true, guarantors: true },
    });
  }

  findAll() {
    return this.prisma.loan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          include: {
            bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } },
          },
        },
        repayments: true,
        guarantors: true,
      },
    });
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } },
          },
        },
        repayments: true,
        guarantors: true,
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async update(id: string, updateLoanDto: UpdateLoanDto) {
    await this.findOne(id);
    if (updateLoanDto.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: updateLoanDto.customerId } });
      if (!customer) throw new NotFoundException('Customer not found');
    }
    return this.prisma.loan.update({
      where: { id },
      data: {
        customerId: updateLoanDto.customerId,
        amount: updateLoanDto.amount,
        interestRate: updateLoanDto.interestRate,
        status: updateLoanDto.status,
        disbursementAmount: updateLoanDto.disbursementAmount,
        disbursementAccountNumber: updateLoanDto.disbursementAccountNumber,
        disbursementAccountName: updateLoanDto.disbursementAccountName,
        disbursementBankCode: updateLoanDto.disbursementBankCode,
        disbursementBankName: updateLoanDto.disbursementBankName,
        disbursementUsesAlternativeAccount: updateLoanDto.disbursementUsesAlternativeAccount,
      },
      include: { customer: true, repayments: true, guarantors: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.loan.delete({ where: { id } });
  }

  async findGuarantors(loanId: string) {
    await this.findOne(loanId);
    return this.prisma.guarantor.findMany({ where: { loanId }, orderBy: { createdAt: 'desc' } });
  }

  async addGuarantor(loanId: string, dto: CreateGuarantorDto) {
    await this.findOne(loanId);
    return this.prisma.guarantor.create({
      data: {
        loanId,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        relationship: dto.relationship,
        idType: dto.idType,
        idNumber: dto.idNumber,
        idDocument: dto.idDocument,
        passportPhoto: dto.passportPhoto,
        temporaryVerified: false,
        verificationNote: dto.verificationNote ?? 'Temporary record only. Identity has not been externally verified.',
      },
    });
  }

  async updateGuarantor(loanId: string, guarantorId: string, dto: Partial<CreateGuarantorDto>) {
    await this.findOne(loanId);
    const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } });
    if (!existing) throw new NotFoundException('Guarantor not found');
    return this.prisma.guarantor.update({
      where: { id: guarantorId },
      data: {
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        relationship: dto.relationship,
        idType: dto.idType,
        idNumber: dto.idNumber,
        idDocument: dto.idDocument,
        passportPhoto: dto.passportPhoto,
        verificationNote: dto.verificationNote,
      },
    });
  }

  async removeGuarantor(loanId: string, guarantorId: string) {
    await this.findOne(loanId);
    const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } });
    if (!existing) throw new NotFoundException('Guarantor not found');
    return this.prisma.guarantor.delete({ where: { id: guarantorId } });
  }
}
