import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffScopeService } from '../access/staff-scope.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { CreateGuarantorDto } from './dto/create-guarantor.dto';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService, private readonly scope: StaffScopeService) {}

  async create(dto: CreateLoanDto, authUser: any) {
    await this.scope.assertCustomerAccess(authUser, dto.customerId);
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.loan.create({
      data: { customerId: dto.customerId, amount: dto.amount, interestRate: dto.interestRate, status: dto.status ?? 'PENDING' },
      include: { customer: true, repayments: true, guarantors: true },
    });
  }

  findAll(authUser: any) {
    return this.prisma.loan.findMany({ where: this.scope.loanWhere(authUser) as any, orderBy: { createdAt: 'desc' }, include: { customer: true, repayments: true, guarantors: true } });
  }

  async findOne(id: string, authUser: any) {
    const loan = await this.prisma.loan.findFirst({ where: { id, ...(await this.scope.loanWhere(authUser)) } as any, include: { customer: true, repayments: true, guarantors: true } });
    if (!loan) throw new NotFoundException('Loan not found or not accessible');
    return loan;
  }

  async update(id: string, dto: UpdateLoanDto, authUser: any) {
    await this.scope.assertLoanAccess(authUser, id);
    if (dto.customerId) await this.scope.assertCustomerAccess(authUser, dto.customerId);
    return this.prisma.loan.update({ where: { id }, data: { customerId: dto.customerId, amount: dto.amount, interestRate: dto.interestRate, status: dto.status }, include: { customer: true, repayments: true, guarantors: true } });
  }

  async remove(id: string, authUser: any) {
    await this.scope.assertLoanAccess(authUser, id);
    return this.prisma.loan.delete({ where: { id } });
  }

  async findGuarantors(loanId: string, authUser: any) {
    await this.scope.assertLoanAccess(authUser, loanId);
    return this.prisma.guarantor.findMany({ where: { loanId }, orderBy: { createdAt: 'desc' } });
  }

  async addGuarantor(loanId: string, dto: CreateGuarantorDto, authUser: any) {
    await this.scope.assertLoanAccess(authUser, loanId);
    return this.prisma.guarantor.create({ data: { loanId, firstName: dto.firstName, middleName: dto.middleName, lastName: dto.lastName, phone: dto.phone, email: dto.email, address: dto.address, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, relationship: dto.relationship, idType: dto.idType, idNumber: dto.idNumber, idDocument: dto.idDocument, passportPhoto: dto.passportPhoto, temporaryVerified: false, verificationNote: dto.verificationNote ?? 'Temporary record only. Identity has not been externally verified.' } });
  }

  async updateGuarantor(loanId: string, guarantorId: string, dto: Partial<CreateGuarantorDto>, authUser: any) {
    await this.scope.assertLoanAccess(authUser, loanId);
    const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } });
    if (!existing) throw new NotFoundException('Guarantor not found');
    return this.prisma.guarantor.update({ where: { id: guarantorId }, data: { firstName: dto.firstName, middleName: dto.middleName, lastName: dto.lastName, phone: dto.phone, email: dto.email, address: dto.address, dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined, relationship: dto.relationship, idType: dto.idType, idNumber: dto.idNumber, idDocument: dto.idDocument, passportPhoto: dto.passportPhoto, verificationNote: dto.verificationNote } });
  }

  async removeGuarantor(loanId: string, guarantorId: string, authUser: any) {
    await this.scope.assertLoanAccess(authUser, loanId);
    const existing = await this.prisma.guarantor.findFirst({ where: { id: guarantorId, loanId } });
    if (!existing) throw new NotFoundException('Guarantor not found');
    return this.prisma.guarantor.delete({ where: { id: guarantorId } });
  }
}
