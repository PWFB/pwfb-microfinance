import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessScopeService } from '../access/access-scope.service';
import { LoanDisbursementService } from '../loans/loan-disbursement.service';

const PENDING = 'DISBURSEMENT_PENDING_BRANCH_REVIEW';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessScopeService,
    private readonly loanDisbursement: LoanDisbursementService,
  ) {}

  private async scope(user: any) { return this.access.getScope(user); }

  async pending(user: any) {
    const scope = await this.scope(user);
    const values: any[] = [PENDING];
    const where: string[] = ['l."status" = $1'];
    if (!scope.global) {
      if (scope.role === 'REGIONAL_MANAGER') { values.push(scope.regionId); where.push(`b."regionId" = $${values.length}`); }
      else if (scope.role === 'DIVISIONAL_MANAGER') { values.push(scope.divisionId); where.push(`b."divisionId" = $${values.length}`); }
      else if (scope.role === 'AREA_MANAGER') { values.push(scope.areaId); where.push(`b."areaId" = $${values.length}`); }
      else { values.push(scope.branchId); where.push(`b."id" = $${values.length}`); }
    }
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT l."id", l."amount", l."disbursementAmount", l."status", l."createdAt",
              c."id" AS "customerId", c."firstName" AS "customerFirstName", c."lastName" AS "customerLastName",
              b."id" AS "branchId", b."name" AS "branchName", b."address" AS "branchAddress"
       FROM "Loan" l
       JOIN "Customer" c ON c."id" = l."customerId"
       LEFT JOIN "Branch" b ON b."id" = c."branchId"
       WHERE ${where.join(' AND ')}
       ORDER BY l."createdAt" ASC`,
      ...values,
    );
  }

  async get(loanId: string, user: any) {
    await this.access.assertLoan(user, loanId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT l."id", l."amount", l."disbursementAmount", l."status", l."createdAt",
              l."disbursementAccountNumber", l."disbursementAccountName", l."disbursementBankName",
              c."id" AS "customerId", c."firstName" AS "customerFirstName", c."lastName" AS "customerLastName",
              b."id" AS "branchId", b."name" AS "branchName", b."address" AS "branchAddress"
       FROM "Loan" l JOIN "Customer" c ON c."id"=l."customerId" LEFT JOIN "Branch" b ON b."id"=c."branchId"
       WHERE l."id"=$1 LIMIT 1`, loanId,
    );
    if (!rows[0]) throw new NotFoundException('Approval record not found');
    return rows[0];
  }

  async approve(loanId: string, user: any) {
    await this.assertApprover(user, loanId);
    return this.loanDisbursement.approveAndDisburse(loanId, user);
  }

  async reject(loanId: string, user: any, reason?: string) {
    await this.assertApprover(user, loanId);
    return this.loanDisbursement.reject(loanId, user, reason);
  }

  async history(loanId: string, user: any) {
    await this.access.assertLoan(user, loanId);
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","actorId","actorEmail","actorRole","action","method","resource","recordId","details","statusCode","createdAt"
       FROM "AuditLog" WHERE "recordId"=$1 AND ("resource" ILIKE '%loan%' OR "resource" ILIKE '%disbursement%' OR "action" ILIKE '%disbursement%')
       ORDER BY "createdAt" DESC LIMIT 100`, loanId,
    );
  }

  private async assertApprover(user: any, loanId: string) {
    const role = String(user?.role || '');
    if (!['SUPER_ADMIN','ADMIN','BRANCH_MANAGER'].includes(role)) throw new ForbiddenException('Only a Branch Manager, Admin or Super Admin can approve disbursement');
    await this.access.assertLoan(user, loanId);
    const loan = await this.get(loanId, user);
    if (loan.status !== PENDING) throw new ForbiddenException('This loan is not waiting for approval');
    return true;
  }
}
