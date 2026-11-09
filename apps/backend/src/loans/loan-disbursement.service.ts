import { BadRequestException, Injectable, NotFoundException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalBankTransferService } from '../banking/external-bank-transfer.service';

const SUBMITTED = 'DISBURSEMENT_PENDING_BRANCH_REVIEW';
const REJECTED = 'DISBURSEMENT_REJECTED';
const PROCESSING = 'DISBURSEMENT_PROCESSING';
const DISBURSED = 'DISBURSED';

@Injectable()
export class LoanDisbursementService {
  constructor(private readonly prisma: PrismaService, private readonly externalBankTransferService: ExternalBankTransferService) {}

  private providerReference(result: unknown, fallback: string) {
    if (!result || typeof result !== 'object') return fallback;
    const value = result as Record<string, unknown>;
    const providerReference = value.providerReference;
    if (typeof providerReference === 'string' && providerReference.trim()) return providerReference;
    const transactionReference = value.transactionReference;
    if (typeof transactionReference === 'string' && transactionReference.trim()) return transactionReference;
    return fallback;
  }

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

  private async ensureDisbursementAttemptTable() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PWFBLoanDisbursementAttempt" (
        "id" TEXT PRIMARY KEY,
        "loanId" TEXT NOT NULL UNIQUE REFERENCES "Loan"("id") ON DELETE RESTRICT,
        "reference" TEXT NOT NULL UNIQUE,
        "amount" DOUBLE PRECISION NOT NULL,
        "accountNumber" TEXT NOT NULL,
        "bankCode" TEXT NOT NULL,
        "bankName" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PROCESSING',
        "providerStatus" TEXT,
        "providerReference" TEXT,
        "createdBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "PWFBLoanDisbursementAttempt_status_idx" ON "PWFBLoanDisbursementAttempt" ("status");
    `);
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
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new BadRequestException('Disbursement amount must be greater than zero');
    const reference = `LOAN-${loan.id}-${Date.now()}`;

    // Claim the loan before making the external provider call. This compare-and-set
    // prevents two concurrent approvals from paying the same loan twice.
    const claimed = await this.prisma.loan.updateMany({
      where: { id: loanId, status: SUBMITTED },
      data: { status: PROCESSING },
    });
    if (claimed.count !== 1) throw new BadRequestException('This loan is already being processed or has changed status');

    await this.ensureDisbursementAttemptTable();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "PWFBLoanDisbursementAttempt" ("id","loanId","reference","amount","accountNumber","bankCode","bankName","createdBy")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      randomUUID(), loan.id, reference, Number(amount), accountNumber, bankCode, bankName, actor.id,
    );

    let providerResult: any;
    try {
      providerResult = await this.externalBankTransferService.transferToVerifiedAccount({
        bankCode, accountNumber, accountName, amount: Number(amount),
        narration: `PWFB loan disbursement ${loan.id}`, reference,
      });
    } catch {
      // A timeout may mean the provider accepted the payout. Keep the loan in
      // PROCESSING and preserve the stable attempt/reference for reconciliation.
      throw new ServiceUnavailableException(`Disbursement status is uncertain. The loan is locked against duplicate payment. Reference: ${reference}`);
    }

    const providerStatus = String(providerResult?.status ?? '').toUpperCase();
    const finalStatus = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(providerStatus) ? DISBURSED : PROCESSING;
    const providerReference = this.providerReference(providerResult, reference);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "PWFBLoanDisbursementAttempt" SET "status"=$2,"providerStatus"=$3,"providerReference"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "loanId"=$1`,
      loanId, finalStatus, providerStatus || 'UNKNOWN', providerReference,
    );

    // Only a provider-confirmed success creates a completed disbursement ledger
    // entry. Pending/uncertain transfers remain visible for reconciliation.
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedCount = await tx.loan.updateMany({
        where: { id: loanId, status: PROCESSING },
        data: { status: finalStatus },
      });
      if (updatedCount.count !== 1) throw new BadRequestException('Loan processing state changed before the provider result could be recorded');
      const updated = await tx.loan.findUnique({
        where: { id: loanId },
        include: { customer: true, repayments: true, guarantors: true },
      });
      if (!updated) throw new NotFoundException('Loan not found after disbursement');
      if (finalStatus === DISBURSED) {
        await tx.transaction.create({
          data: {
            customerId: loan.customerId,
            type: 'LOAN_DISBURSEMENT',
            amount: Number(amount),
            description: `DISBURSED: loan ${loan.id} paid to ${accountNumber} (${bankName}) by ${actor.firstName} ${actor.lastName}. Provider reference: ${providerReference}`,
          },
        });
      }
      return updated;
    });

    return { loan: result, status: finalStatus, provider: this.externalBankTransferService.currentProvider(), providerReference, beneficiary: { accountNumber, accountName, bank: bankName, bankCode, amount: Number(amount), alternative: useAlternative, verified: true, nameMatch: true } };
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
