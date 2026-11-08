import { BadRequestException, CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchClosingLockInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const method = String(req.method || '').toUpperCase();
    const path = String(req.path || req.route?.path || '').toLowerCase();

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();
    if (path.includes('/branch-closing') || path.includes('/auth') || path.includes('/webhooks') || path.includes('/permissions') || path.includes('/approvals')) return next.handle();

    let branchId = req.body?.branchId || req.query?.branchId;
    let operationDate = req.body?.collectionDate || req.body?.entryDate || req.body?.paymentDate || req.body?.transactionDate;

    if (!branchId && path.includes('/collections') && req.params?.id) {
      const row = await this.prisma.dailyCollection.findUnique({ where: { id: String(req.params.id) }, select: { branchId: true, collectionDate: true } });
      branchId = row?.branchId;
      operationDate = operationDate || row?.collectionDate;
    }

    if (!branchId && path.includes('/savings') && req.params?.id) {
      const row = await this.prisma.savings.findUnique({ where: { id: String(req.params.id) }, select: { customer: { select: { branchId: true } } } });
      branchId = row?.customer?.branchId;
    }

    if (!branchId && path.includes('/repayments') && (req.body?.loanId || req.params?.id)) {
      const loanId = req.body?.loanId || req.params?.id;
      const row = await this.prisma.loan.findUnique({ where: { id: String(loanId) }, select: { customer: { select: { branchId: true } } } });
      branchId = row?.customer?.branchId;
    }

    if (!branchId && req.body?.customerId) {
      const row = await this.prisma.customer.findUnique({ where: { id: String(req.body.customerId) }, select: { branchId: true } });
      branchId = row?.branchId;
    }

    if (!branchId) return next.handle();

    const date = operationDate ? new Date(operationDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid transaction date');
    const day = date.toISOString().slice(0, 10);
    const closed = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","branchId","periodId","closingDate" FROM "BranchClosing" WHERE "branchId"=$1 AND "closingDate"=$2::date AND status='CLOSED' LIMIT 1`,
      String(branchId), day,
    );
    if (closed.length) {
      throw new BadRequestException(`Branch is closed for ${day}. New financial transactions are blocked for this date. Use the authorized correction/reopening process.`);
    }

    return next.handle();
  }
}
