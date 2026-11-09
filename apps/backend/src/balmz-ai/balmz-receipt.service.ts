import { fetchWithTimeout } from '../ai/ai-http.util';
import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createFinancialReference } from '../common/financial-reference';
import { AccessScopeService } from '../access/access-scope.service';

type ReceiptStatus = 'VERIFIED' | 'FAILED' | 'REVIEW';

type ReceiptResult = {
  assistant: 'BALMZ AI';
  status: ReceiptStatus;
  confidence: number;
  message: string;
  extracted: {
    paymentStatus: string | null;
    amount: number | null;
    currency: string | null;
    reference: string | null;
    date: string | null;
    sender: string | null;
    receiver: string | null;
    bankOrProvider: string | null;
  };
  databaseMatch: {
    matched: boolean;
    source: 'transaction' | 'wallet' | 'collection' | null;
    id: string | null;
    amount: number | null;
    status: string | null;
  };
  reasons: string[];
  receiptReference: string;
  receiptId: string;
};

@Injectable()
export class BalmzReceiptService {
  constructor(private readonly prisma: PrismaService, private readonly accessScope: AccessScopeService) {}

  private parseJson(text: string): any {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    try { return JSON.parse(cleaned); } catch { return null; }
  }

  private extractText(payload: any): string {
    if (typeof payload?.output_text === 'string') return payload.output_text;
    const parts: string[] = [];
    for (const item of payload?.output || []) {
      for (const content of item?.content || []) {
        if (typeof content?.text === 'string') parts.push(content.text);
      }
    }
    return parts.join('\n').trim();
  }

  private async findDatabaseMatch(reference: string | null, amount: number | null, user: { id: string; role: string; customerId?: string | null; staffId?: string | null }) {
    if (!reference && amount == null) return { matched: false, source: null, id: null, amount: null, status: null };

    const role = String(user.role || '').toUpperCase();
    let transactionScope: any = {};
    let collectionScope: any = {};
    let walletCustomerScope: any = {};
    let walletScope: any = {};
    if (role === 'CUSTOMER') {
      const customerId = String(user.customerId || '').trim();
      if (!customerId) return { matched: false, source: null, id: null, amount: null, status: null };
      transactionScope.customerId = customerId;
      collectionScope.customerId = customerId;
      walletCustomerScope.customerId = customerId;
    } else if (role !== 'SUPER_ADMIN') {
      const scopeActor = { id: user.id, role: user.role, ...(user.staffId ? { staffId: user.staffId } : {}) };
      const scope = await this.accessScope.getScope(scopeActor);
      const branchIds = await this.accessScope.getScopedBranchIds(scopeActor) || [];
      if (!branchIds.length) return { matched: false, source: null, id: null, amount: null, status: null };
      transactionScope.customer = { branchId: { in: branchIds } };
      collectionScope.branchId = { in: branchIds };
      walletCustomerScope.branchId = { in: branchIds };
      walletScope.OR = [{ branchId: { in: branchIds } }, { branchId: null }];
      if (['CREDIT_OFFICER', 'TELLER', 'LOAN_OFFICER', 'STAFF'].includes(role)) {
        if (!scope.staffId) return { matched: false, source: null, id: null, amount: null, status: null };
        transactionScope.customer.assignedStaffId = scope.staffId;
        collectionScope.staffId = scope.staffId;
        walletCustomerScope.assignedStaffId = scope.staffId;
      }
    }

    if (Object.keys(walletCustomerScope).length) walletScope.customer = walletCustomerScope;

    if (reference) {
      const transactions = await this.prisma.transaction.findMany({
        where: { ...transactionScope, reference: { contains: reference, mode: 'insensitive' } },
        select: { id: true, amount: true, type: true },
        take: 5,
      });
      if (transactions.length) {
        const match = transactions.find((row) => amount == null || Math.abs(row.amount - amount) <= 0.01) || transactions[0];
        return { matched: amount == null || Math.abs(match.amount - (amount || match.amount)) <= 0.01, source: 'transaction' as const, id: match.id, amount: match.amount, status: match.type };
      }

      const walletWhere = Object.keys(walletScope).length
        ? { AND: [walletScope, { OR: [
            { reference: { contains: reference, mode: 'insensitive' } },
            { providerReference: { contains: reference, mode: 'insensitive' } },
          ] }] }
        : { OR: [
            { reference: { contains: reference, mode: 'insensitive' } },
            { providerReference: { contains: reference, mode: 'insensitive' } },
          ] };
      const walletTransactions = await this.prisma.walletTransaction.findMany({
        where: walletWhere,
        select: { id: true, amount: true, type: true, status: true },
        take: 5,
      });
      if (walletTransactions.length) {
        const match = walletTransactions.find((row) => amount == null || Math.abs(row.amount - amount) <= 0.01) || walletTransactions[0];
        return { matched: amount == null || Math.abs(match.amount - (amount || match.amount)) <= 0.01, source: 'wallet' as const, id: match.id, amount: match.amount, status: match.status || match.type };
      }

      const collections = await this.prisma.dailyCollection.findMany({
        where: { ...collectionScope, reference: { contains: reference, mode: 'insensitive' } },
        select: { id: true, amount: true, reconciled: true },
        take: 5,
      });
      if (collections.length) {
        const match = collections.find((row) => amount == null || Math.abs(row.amount - amount) <= 0.01) || collections[0];
        return { matched: amount == null || Math.abs(match.amount - (amount || match.amount)) <= 0.01, source: 'collection' as const, id: match.id, amount: match.amount, status: match.reconciled ? 'RECONCILED' : 'UNRECONCILED' };
      }
    }

    return { matched: false, source: null, id: null, amount: null, status: null };
  }

  private async persistReceipt(file: { buffer: Buffer; mimetype: string; originalname: string }, user: { id: string }, result: Omit<ReceiptResult, 'receiptReference' | 'receiptId'>): Promise<ReceiptResult> {
    const receiptReference = createFinancialReference('PWFB-RCP');
    const saved = await this.prisma.receiptVerification.create({
      data: {
        reference: receiptReference,
        fileName: String(file.originalname || 'receipt').slice(0, 255),
        mimeType: file.mimetype,
        file: Uint8Array.from(file.buffer),
        status: result.status,
        confidence: result.confidence,
        extracted: result.extracted as any,
        databaseMatch: result.databaseMatch as any,
        reasons: result.reasons as any,
        uploadedByUserId: user.id,
        transactionId: result.databaseMatch.source === 'transaction' ? result.databaseMatch.id : null,
      },
      select: { id: true },
    });
    return { ...result, receiptReference, receiptId: saved.id };
  }

  async verifyReceipt(file: { buffer: Buffer; mimetype: string; originalname: string }, user: { id: string; role: string; customerId?: string | null; staffId?: string | null }): Promise<ReceiptResult> {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Upload a JPG, PNG, WEBP or GIF payment receipt image.');
    if (!file.buffer?.length) throw new BadRequestException('The uploaded receipt is empty.');
    if (file.buffer.length > 6 * 1024 * 1024) throw new BadRequestException('Receipt image must be 6 MB or smaller.');

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ServiceUnavailableException('BALMZ AI receipt verification is not configured on the backend.');

    const model = process.env.BALMZ_AI_VISION_MODEL || process.env.BALMZ_AI_MODEL || 'gpt-5.6-luna';
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const prompt = `You are BALMZ AI, a conservative payment-receipt verification engine for PWFB Microfinance. Inspect the uploaded payment slip image. Do not guess unreadable values. Extract only visible information. Determine whether the receipt itself says successful, failed, pending, reversed, declined, or unknown. Return ONLY valid JSON with this exact shape: {"paymentStatus":"successful|failed|pending|reversed|declined|unknown","amount":number|null,"currency":string|null,"reference":string|null,"date":string|null,"sender":string|null,"receiver":string|null,"bankOrProvider":string|null,"confidence":number,"reasons":[string]}. A receipt image alone is not proof that money settled; database reconciliation will be used separately.`;

    const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: imageUrl, detail: 'high' }] }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException('BALMZ AI receipt provider is temporarily unavailable. Please try again shortly.');
    }

    const payload = await response.json();
    const parsed = this.parseJson(this.extractText(payload));
    if (!parsed) throw new ServiceUnavailableException('BALMZ AI could not produce a structured receipt verification result.');

    const extracted = {
      paymentStatus: typeof parsed.paymentStatus === 'string' ? parsed.paymentStatus.toLowerCase() : 'unknown',
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      currency: parsed.currency || null,
      reference: parsed.reference || null,
      date: parsed.date || null,
      sender: parsed.sender || null,
      receiver: parsed.receiver || null,
      bankOrProvider: parsed.bankOrProvider || null,
    };
    const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
    const databaseMatch = await this.findDatabaseMatch(extracted.reference, extracted.amount, user);
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [];

    if (extracted.paymentStatus === 'failed' || extracted.paymentStatus === 'declined' || extracted.paymentStatus === 'reversed') {
      return this.persistReceipt(file, user, { assistant: 'BALMZ AI', status: 'FAILED', confidence, message: 'The uploaded receipt indicates that the payment did not successfully settle.', extracted, databaseMatch, reasons });
    }

    if (extracted.paymentStatus === 'successful' && databaseMatch.matched) {
      reasons.push('Receipt status is successful and the payment reference/amount matches a PWFB financial record.');
      return this.persistReceipt(file, user, { assistant: 'BALMZ AI', status: 'VERIFIED', confidence, message: 'Payment receipt verified against the PWFB financial records.', extracted, databaseMatch, reasons });
    }

    if (extracted.paymentStatus === 'successful' && !databaseMatch.matched) {
      reasons.push('Receipt says successful, but no matching PWFB transaction/collection was found.');
      return this.persistReceipt(file, user, { assistant: 'BALMZ AI', status: 'REVIEW', confidence, message: 'The receipt appears successful, but BALMZ AI could not reconcile it with a PWFB financial record.', extracted, databaseMatch, reasons });
    }

    reasons.push('The receipt status or payment details are incomplete, ambiguous, or not yet reconciled.');
    return this.persistReceipt(file, user, { assistant: 'BALMZ AI', status: 'REVIEW', confidence, message: 'Manual review is required before treating this receipt as a successful payment.', extracted, databaseMatch, reasons });
  }
}
