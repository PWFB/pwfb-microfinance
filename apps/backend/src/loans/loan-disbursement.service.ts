import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalBankTransferService } from '../banking/external-bank-transfer.service';

const SUBMITTED = 'DISBURSEMENT_PENDING_BRANCH_REVIEW';
const REJECTED = 'DISBURSEMENT_REJECTED';
const PROCESSING = 'DISBURSEMENT_PROCESSING';
const DISBURSED = 'DISBURSED';

@Injectable()
export class LoanDisbursementService {
  constructor(private readonly prisma: PrismaService, private readonly externalBankTransferService: ExternalBankTransferService) {}

  private async actor(user: any) {
    const actor = await this.prisma.user.findUnique({ where: { id: user?.sub }, include: { staff: { include: { assignments: true, branch: true } } } });
    if (!actor) throw new UnauthorizedException('Authenticated user not found');
    return actor;
  }

  private async activeBranchAssignment(staffId: string, role: string, branchId: string) {
    return this.prisma.staffAssignment.findFirst({ where: { staffId, role: role as any, branchId, active: true, endsAt: null } });
  }

  private async getLoan(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: { customer: { include: { bankAccounts: { where: { status: 'ACTIVE' }, include: { institution: true }, orderBy: { isPrimary: 'desc' } }, branch: true } }, guarantors: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async submitForBranchReview(loanId: string, user: any, input?: { accountNumber?: string; accountName?: string; bankCode?: string; bankName?: string; amount?: number }) {
    const actor = await this.actor(user);
    if (actor.role !== 'CREDIT_OFFICER') throw new UnauthorizedException('Only a Credit Officer can submit a loan for disbursement');
    if (!actor.staff) throw new UnauthorizedException('Credit Officer staff profile not found');
    const loan = await this.getLoan(loanId);
    if (!loan.customer.branchId || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException("This loan is outside the Credit Officer's assigned branch");
    const assignment = await this.activeBranchAssignment(actor.staff.id, 'CREDIT_OFFICER', actor.staff.branchId);
    if (!assignment) throw new UnauthorizedException('Credit Officer is not actively assigned to this branch');
    if (![undefined, null, 'PENDING', 'APPROVED'].includes(loan.status)) throw new BadRequestException(`Loan cannot be submitted from status ${loan.status}`);

    const accountNumber = input?.accountNumber?.trim();
    const accountName = input?.accountName?.trim();
    const bankCode = input?.bankCode?.trim();
    const bankName = input?.bankName?.trim();
    const hasAlternative = Boolean(accountNumber || accountName || bankCode || bankName);
    if (hasAlternative && (!accountNumber || !accountName || !bankCode || !bankName)) throw new BadRequestException('Alternative disbursement account requires account number, account name, bank code and bank name');
    const disbursementAmount = input?.amount ?? loan.amount;
    if (!Number.isFinite(disbursementAmount) || disbursementAmount <= 0) throw new BadRequestException('Disbursement amount must be greater than zero');
    if (disbursementAmount > loan.amount) throw new BadRequestException('Disbursement amount cannot exceed the approved loan amount');

    if (hasAlternative) {
      const verified = await this.externalBankTransferService.verifyCustomerBankAccount(loan.customerId, bankCode!, accountNumber!);
      return this.prisma.loan.update({ where: { id: loanId }, data: { status: SUBMITTED, disbursementAmount, disbursementAccountNumber: verified.accountNumber, disbursementAccountName: verified.accountName, disbursementBankCode: bankCode, disbursementBankName: bankName, disbursementUsesAlternativeAccount: true }, include: { customer: true, repayments: true, guarantors: true } });
    }

    return this.prisma.loan.update({ where: { id: loanId }, data: { status: SUBMITTED, disbursementAmount, disbursementUsesAlternativeAccount: false }, include: { customer: true, repayments: true, guarantors: true } });
  }

  async approveAndDisburse(loanId: string, user: any) {
    const actor = await this.actor(user);
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN';
    if (!isAdmin && actor.role !== 'BRANCH_MANAGER') throw new UnauthorizedException('Only a Branch Manager, Admin or Super Admin can approve disbursement');
    const loan = await this.getLoan(loanId);
    if (loan.status !== SUBMITTED) throw new BadRequestException('Loan is not waiting for Branch Manager confirmation');
    if (!isAdmin) {
      if (!actor.staff) throw new UnauthorizedException('Branch Manager staff profile not found');
      if (!loan.customer.branchId || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException("This loan is outside the Branch Manager's assigned branch");
      const assignment = await this.activeBranchAssignment(actor.staff.id, 'BRANCH_MANAGER', actor.staff.branchId);
      if (!assignment) throw new UnauthorizedException('Branch Manager is not actively assigned to this branch');
    }

    const useAlternative = loan.disbursementUsesAlternativeAccount;
    const registered = loan.customer.bankAccounts[0];
    const accountNumber = useAlternative ? loan.disbursementAccountNumber?.trim() : registered?.accountNumber;
    const storedAccountName = useAlternative ? loan.disbursementAccountName?.trim() : registered?.accountName?.trim();
    const bankCode = useAlternative ? loan.disbursementBankCode?.trim() : registered?.institution.code?.trim();
    const bankName = useAlternative ? loan.disbursementBankName?.trim() : registered?.institution.name;
    if (!accountNumber || !bankCode || !bankName) throw new BadRequestException('Complete beneficiary account details are required before disbursement');

    const verified = await this.externalBankTransferService.verifyCustomerBankAccount(loan.customerId, bankCode, accountNumber);
    const accountName = String(verified.accountName || storedAccountName || '').trim();
    if (!accountName) throw new BadRequestException('Bank provider did not return a verified beneficiary name');

    const amount = loan.disbursementAmount ?? loan.amount;
    const reference = `LOAN-${loan.id}-${Date.now()}`;
    const narration = `PWFB loan disbursement ${loan.id}`;
    const providerResult = await this.externalBankTransferService.transferToVerifiedAccount({ bankCode, accountNumber, accountName, amount, narration, reference });

    const providerStatus = String(providerResult?.status ?? '').toUpperCase();
    const finalStatus = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(providerStatus) ? DISBURSED : PROCESSING;
    const updated = await this.prisma.loan.update({ where: { id: loanId }, data: { status: finalStatus }, include: { customer: true, repayments: true, guarantors: true } });
    await this.prisma.transaction.create({ data: { customerId: loan.customerId, type: 'LOAN_DISBURSEMENT', amount, description: `${finalStatus}: loan ${loan.id} paid to ${accountNumber} (${bankName}) by ${actor.firstName} ${actor.lastName}. Provider reference: ${String(providerResult?.providerReference ?? providerResult?.transactionReference ?? reference)}` } });
    return { loan: updated, status: finalStatus, provider: this.externalBankTransferService.currentProvider(), providerReference: String(providerResult?.providerReference ?? providerResult?.transactionReference ?? reference), beneficiary: { accountNumber, accountName, bank: bankName, bankCode, amount, alternative: useAlternative, verified: true, nameMatch: true } };
  }

  async reject(loanId: string, user: any, reason?: string) {
    const actor = await this.actor(user);
    const isAdmin = actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN';
    if (!isAdmin && actor.role !== 'BRANCH_MANAGER') throw new UnauthorizedException('Only a Branch Manager, Admin or Super Admin can reject disbursement');
    const loan = await this.getLoan(loanId);
    if (loan.status !== SUBMITTED) throw new BadRequestException('Loan is not waiting for Branch Manager confirmation');
    if (!isAdmin) {
      if (!actor.staff || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException("This loan is outside the Branch Manager's assigned branch");
      const assignment = await this.activeBranchAssignment(actor.staff.id, 'BRANCH_MANAGER', actor.staff.branchId);
      if (!assignment) throw new UnauthorizedException('Branch Manager is not actively assigned to this branch');
    }
    return this.prisma.loan.update({ where: { id: loanId }, data: { status: `${REJECTED}: ${String(reason || 'Branch Manager rejected the disbursement').slice(0, 240)}` }, include: { customer: true, repayments: true, guarantors: true } });
  }
}