import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExternalBankTransferService } from '../banking/external-bank-transfer.service';

const SUBMITTED = 'DISBURSEMENT_PENDING_BRANCH_REVIEW';
const REJECTED = 'DISBURSEMENT_REJECTED';
const PROCESSING = 'DISBURSEMENT_PROCESSING';
const DISBURSED = 'DISBURSED';
const DISBURSEMENT_FAILED = 'DISBURSEMENT_FAILED';

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
    const actor = await this.prisma.user.findUnique({ where: { id: user?.id || user?.sub }, include: { staff: { include: { assignments: true, branch: true } } } });
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
    if (!['CREDIT_OFFICER', 'TELLER'].includes(String(actor.role))) throw new UnauthorizedException('Only the registering Credit Officer or Teller can submit this loan for disbursement');
    if (!actor.staff || actor.staff.employmentStatus !== 'ACTIVE') throw new UnauthorizedException('Active staff profile not found');
    const loan = await this.getLoan(loanId);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "PWFBLoanMeta" ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT`);
    const ownership = await this.prisma.$queryRawUnsafe<Array<{ createdByStaffId: string | null; creatorUserId: string | null }>>(
      `SELECT "createdByStaffId", "creatorUserId" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,
      loanId,
    );
    if (!loan.customer.branchId || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException('This loan is outside your assigned branch');
    if (loan.customer.assignedStaffId !== actor.staff.id || ownership[0]?.createdByStaffId !== actor.staff.id || ownership[0]?.creatorUserId !== actor.id) {
      throw new UnauthorizedException('You can submit only a loan you personally created for your own registered customer');
    }
    const assignment = await this.activeBranchAssignment(actor.staff.id, actor.role, actor.staff.branchId);
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

  async reviewAssetLoan(loanId: string, user: any, note?: string) {
    const actor = await this.actor(user);
    if (actor.role !== 'ASSET_LOAN_MANAGER') throw new UnauthorizedException('Only an Asset Loan Manager may review this loan');
    if (!actor.staff || actor.staff.employmentStatus !== 'ACTIVE' || !actor.staff.branchId) {
      throw new UnauthorizedException('Asset Loan Manager must have an active Staff ID and branch assignment');
    }
    const assignment = await this.activeBranchAssignment(actor.staff.id, 'ASSET_LOAN_MANAGER', actor.staff.branchId);
    if (!assignment) throw new UnauthorizedException('Asset Loan Manager is not actively assigned to this branch');

    const loan = await this.getLoan(loanId);
    if (loan.customer.branchId !== actor.staff.branchId) {
      throw new UnauthorizedException('This loan is outside the Asset Loan Manager assigned branch');
    }
    if (loan.status !== SUBMITTED) {
      throw new BadRequestException('Only a submitted loan awaiting branch review can receive asset review');
    }

    const meta = await this.prisma.$queryRawUnsafe<Array<{
      loanType: string | null;
      assetReviewStatus: string | null;
      createdByStaffId: string | null;
      creatorUserId: string | null;
    }>>(
      `SELECT "loanType","assetReviewStatus","createdByStaffId","creatorUserId" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,
      loanId,
    );
    if (meta[0]?.loanType !== 'Individual Loan') {
      throw new BadRequestException('Asset Loan Manager review is reserved for Individual Loan applications');
    }
    if (meta[0]?.assetReviewStatus !== 'PENDING_ASSET_REVIEW') {
      throw new BadRequestException('This loan is not waiting for Asset Loan Manager review');
    }
    if (meta[0]?.createdByStaffId === actor.staff.id || meta[0]?.creatorUserId === actor.id) {
      throw new UnauthorizedException('The loan creator cannot approve their own asset-loan review');
    }
    const reviewNote = String(note || '').trim();
    if (reviewNote.length < 5) throw new BadRequestException('A meaningful asset review note of at least 5 characters is required');
    if (reviewNote.length > 500) throw new BadRequestException('Asset review note cannot exceed 500 characters');

    return this.prisma.$transaction(async tx => {
      const updated = await tx.$executeRawUnsafe(
        `UPDATE "PWFBLoanMeta" SET "assetReviewStatus"='APPROVED',"assetReviewedByStaffId"=$2,"assetReviewedByUserId"=$3,"assetReviewedAt"=CURRENT_TIMESTAMP,"assetReviewNote"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "loanId"=$1 AND "assetReviewStatus"='PENDING_ASSET_REVIEW'`,
        loanId, actor.staff.id, actor.id, reviewNote || null,
      );
      if (updated !== 1) throw new BadRequestException('Asset review was already processed or is no longer pending');
      await tx.$executeRawUnsafe(
        `INSERT INTO "PWFBLoanReviewEvent" ("id","loanId","actorUserId","actorStaffId","action","note") VALUES ($1,$2,$3,$4,'ASSET_REVIEW_APPROVED',$5)`,
        randomUUID(), loanId, actor.id, actor.staff.id, reviewNote || null,
      );
      const rows = await tx.$queryRawUnsafe<any[]>(
        `SELECT "assetReviewStatus","assetReviewedByStaffId","assetReviewedByUserId","assetReviewedAt","assetReviewNote" FROM "PWFBLoanMeta" WHERE "loanId"=$1`,
        loanId,
      );
      return { loanId, ...rows[0], reviewedBy: { staffId: actor.staff.staffId, name: [actor.firstName, actor.lastName].filter(Boolean).join(' ') } };
    });
  }

  async approveAndDisburse(loanId: string, user: any) {
    const actor = await this.actor(user);
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isBranchAdmin = actor.role === 'ADMIN';
    const isBranchManager = actor.role === 'BRANCH_MANAGER';
    if (!isSuperAdmin && !isBranchAdmin && !isBranchManager) throw new UnauthorizedException('Only an assigned Branch Manager, branch Admin or Super Admin can approve disbursement');
    const loan = await this.getLoan(loanId);
    if (loan.status !== SUBMITTED) throw new BadRequestException('Loan is not waiting for Branch Manager confirmation');
    const loanMeta = await this.prisma.$queryRawUnsafe<Array<{
      loanType: string | null; assetReviewStatus: string | null;
      assetReviewedByStaffId: string | null; createdByStaffId: string | null;
    }>>(
      `SELECT "loanType","assetReviewStatus","assetReviewedByStaffId","createdByStaffId" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,
      loanId,
    );
    if (loanMeta[0]?.loanType === 'Individual Loan') {
      if (loanMeta[0]?.assetReviewStatus !== 'APPROVED') {
        throw new BadRequestException('Individual Loan requires independent Asset Loan Manager approval before branch disbursement');
      }
      if (!isSuperAdmin && actor.staff?.id && (
        actor.staff.id === loanMeta[0]?.createdByStaffId ||
        actor.staff.id === loanMeta[0]?.assetReviewedByStaffId
      )) {
        throw new UnauthorizedException('Final disbursement must be approved by a different staff member from the loan creator and asset reviewer');
      }
    }
    if (isBranchAdmin && (!actor.staff || loan.customer.branchId !== actor.staff.branchId)) {
      throw new UnauthorizedException('Branch Admin can approve only loans from the assigned branch');
    }
    if (!isSuperAdmin) {
      if (!actor.staff) throw new UnauthorizedException('Branch management account is not linked to an assigned staff record');
      if (!loan.customer.branchId || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException('This loan is outside your assigned branch');
      if (isBranchManager) {
        const assignment = await this.activeBranchAssignment(actor.staff.id, 'BRANCH_MANAGER', actor.staff.branchId);
        if (!assignment) throw new UnauthorizedException('Branch Manager is not actively assigned to this branch');
      }
    }

    const metaRows = await this.prisma.$queryRawUnsafe<Array<{ disbursementDestination: string | null }>>(
      `SELECT "disbursementDestination" FROM "PWFBLoanMeta" WHERE "loanId"=$1 LIMIT 1`,
      loan.id,
    );
    const destination = String(metaRows[0]?.disbursementDestination || 'WALLET').toUpperCase();
    const amount = Number(loan.disbursementAmount ?? loan.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Loan disbursement amount must be greater than zero');

    if (destination === 'WALLET') {
      const claimed = await this.prisma.loan.updateMany({
        where: { id: loanId, status: SUBMITTED },
        data: { status: PROCESSING },
      });
      if (claimed.count !== 1) throw new BadRequestException('This loan disbursement is already being processed or is no longer awaiting approval');
      try {
        const result = await this.prisma.$transaction(async tx => {
          const wallet = await tx.customerWallet.upsert({
            where: { customerId: loan.customerId },
            create: { customerId: loan.customerId, balance: 0 },
            update: {},
          });
          await tx.$queryRawUnsafe('SELECT id FROM "CustomerWallet" WHERE id=$1 FOR UPDATE', wallet.id);
          const lockedWallet = await tx.customerWallet.findUnique({ where: { id: wallet.id } });
          if (!lockedWallet || lockedWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');
          const reference = `LOAN-${loan.id}-WALLET`;
          const existing = await tx.walletTransaction.findUnique({ where: { reference } });
          if (existing) {
            if (existing.status === 'COMPLETED' && existing.newBalance !== undefined) {
              throw new BadRequestException('A wallet disbursement transaction already exists for this loan');
            }
            throw new BadRequestException('A previous wallet disbursement requires reconciliation before retry');
          }
          const previousBalance = Math.round(Number(lockedWallet.balance || 0) * 100) / 100;
          const newBalance = Math.round((previousBalance + amount) * 100) / 100;
          const updatedWallet = await tx.customerWallet.update({ where: { id: wallet.id }, data: { balance: newBalance } });
          const walletTransaction = await tx.walletTransaction.create({
            data: {
              customerId: loan.customerId,
              type: 'DEPOSIT',
              amount,
              previousBalance,
              newBalance,
              reference,
              description: `PWFB loan disbursement ${loan.id}`,
              branchId: loan.customer.branchId || undefined,
              status: 'COMPLETED',
              provider: 'PWFB_LOAN',
              processedAt: new Date(),
            },
          });
          const ledger = await tx.transaction.create({
            data: {
              customerId: loan.customerId,
              type: 'LOAN_DISBURSEMENT',
              amount,
              description: `Confirmed wallet disbursement for loan ${loan.id}; wallet reference ${reference}`,
            },
          });
          const updatedLoan = await tx.loan.update({
            where: { id: loanId, status: PROCESSING },
            data: { status: DISBURSED },
            include: { customer: true, repayments: true, guarantors: true },
          });
          return { wallet: updatedWallet, walletTransaction, ledger, loan: updatedLoan };
        });
        return {
          loan: result.loan,
          status: DISBURSED,
          destination: 'WALLET',
          wallet: result.wallet,
          transaction: result.walletTransaction,
          ledger: result.ledger,
          amount,
        };
      } catch (error) {
        // This path does not call an external provider. If the local DB transaction
        // rolled back, it is safe to release the processing claim for a controlled retry.
        await this.prisma.loan.updateMany({
          where: { id: loanId, status: PROCESSING },
          data: { status: SUBMITTED },
        });
        throw error;
      }
    }

    if (destination !== 'BANK') throw new BadRequestException('Unsupported loan disbursement destination');

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

    const reference = `LOAN-${loan.id}-${Date.now()}`;
    const narration = `PWFB loan disbursement ${loan.id}`;

    // Atomically claim the submitted loan before calling the external provider.
    // Concurrent approvals cannot initiate a second payout for the same loan.
    const claimed = await this.prisma.loan.updateMany({
      where: { id: loanId, status: SUBMITTED },
      data: { status: PROCESSING },
    });
    if (claimed.count !== 1) throw new BadRequestException('This loan disbursement is already being processed or is no longer awaiting approval');

    let providerResult: any;
    try {
      providerResult = await this.externalBankTransferService.transferToVerifiedAccount({ bankCode, accountNumber, accountName, amount, narration, reference });
    } catch {
      // The provider may have accepted the transfer before a timeout. Keep the claim
      // in PROCESSING for manual/provider reconciliation; never issue an automatic retry.
      throw new ServiceUnavailableException(`Loan payout status is uncertain. The loan remains in processing for reconciliation. Reference: ${reference}`);
    }

    const providerStatus = String(providerResult?.status ?? '').toUpperCase();
    const isSuccess = ['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(providerStatus);
    const isDefinitiveFailure = ['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(providerStatus);
    const finalStatus = isSuccess ? DISBURSED : isDefinitiveFailure ? DISBURSEMENT_FAILED : PROCESSING;
    const providerReference = this.providerReference(providerResult, reference);

    // Only confirmed provider success creates the completed disbursement ledger entry.
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.loan.update({
        where: { id: loanId, status: PROCESSING },
        data: { status: finalStatus },
        include: { customer: true, repayments: true, guarantors: true },
      });
      if (isSuccess) {
        await tx.transaction.create({
          data: {
            customerId: loan.customerId,
            type: 'LOAN_DISBURSEMENT',
            amount,
            description: `DISBURSED: loan ${loan.id} paid to ${accountNumber} (${bankName}) by ${actor.firstName} ${actor.lastName}. Provider reference: ${providerReference}`,
          },
        });
      }
      return updated;
    });

    return { loan: result, status: finalStatus, provider: this.externalBankTransferService.currentProvider(), providerReference, beneficiary: { accountNumber, accountName, bank: bankName, bankCode, amount, alternative: useAlternative, verified: true, nameMatch: true } };
  }

  async reject(loanId: string, user: any, reason?: string) {
    const actor = await this.actor(user);
    const isSuperAdmin = actor.role === 'SUPER_ADMIN';
    const isBranchAdmin = actor.role === 'ADMIN';
    const isBranchManager = actor.role === 'BRANCH_MANAGER';
    if (!isSuperAdmin && !isBranchAdmin && !isBranchManager) throw new UnauthorizedException('Only an assigned Branch Manager, branch Admin or Super Admin can reject disbursement');
    const loan = await this.getLoan(loanId);
    if (loan.status !== SUBMITTED) throw new BadRequestException('Loan is not waiting for Branch Manager confirmation');
    if (!isSuperAdmin) {
      if (!actor.staff || loan.customer.branchId !== actor.staff.branchId) throw new UnauthorizedException('This loan is outside your assigned branch');
      if (isBranchManager) {
        const assignment = await this.activeBranchAssignment(actor.staff.id, 'BRANCH_MANAGER', actor.staff.branchId);
        if (!assignment) throw new UnauthorizedException('Branch Manager is not actively assigned to this branch');
      }
    }
    return this.prisma.loan.update({ where: { id: loanId }, data: { status: `${REJECTED}: ${String(reason || 'Branch Manager rejected the disbursement').slice(0, 240)}` }, include: { customer: true, repayments: true, guarantors: true } });
  }
}
