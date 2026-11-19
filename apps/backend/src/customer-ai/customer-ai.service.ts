import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { fetchWithTimeout } from '../ai/ai-http.util';

type CaseAttachmentInput = { fileName?: unknown; mimeType?: unknown; dataBase64?: unknown };
type PreparedAttachment = { fileName: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; dataBase64: string; contentBytes: Buffer };

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 8 * 1024 * 1024;

@Injectable()
export class CustomerAiService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCustomer(authUser: any) {
    const userId = String(authUser?.id || authUser?.sub || '').trim();
    if (!userId || String(authUser?.role || '').toUpperCase() !== 'CUSTOMER') {
      throw new UnauthorizedException('Sign in with your PWFB customer account to use BALMZ AI.');
    }
    const linkedCustomerId = String(authUser?.customerId || '').trim();
    const customer = await this.prisma.customer.findFirst({
      where: { OR: [{ userId }, ...(linkedCustomerId ? [{ id: linkedCustomerId }] : [])] },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });
    if (!customer || (customer.userId && customer.userId !== userId) || (customer.userId !== userId && customer.id !== linkedCustomerId)) {
      throw new UnauthorizedException('Your customer profile is not linked to this login. Contact PWFB support to link your account.');
    }
    return customer;
  }

  private async providerUnavailable(customerId: string, supportCase: any) {
    const reply = 'I could not reach the AI service just now. Your complaint and any receipt you uploaded have been saved under case ' + supportCase.reference + '. Please retry or contact PWFB support and quote this reference.';
    await this.prisma.customerAiCaseMessage.create({
      data: { caseId: supportCase.id, customerId, role: 'assistant', content: reply },
    });
    await this.prisma.customerAiCase.update({ where: { id: supportCase.id }, data: { updatedAt: new Date() } });
    return {
      assistant: 'BALMZ AI',
      configured: false,
      reply,
      customerId,
      caseId: supportCase.id,
      caseReference: supportCase.reference,
      status: supportCase.status,
    };
  }

  private caseReference() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return 'PWFB-AI-' + date + '-' + randomBytes(6).toString('hex').toUpperCase();
  }

  private prepareAttachments(raw: unknown): PreparedAttachment[] {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw) || raw.length > 4) {
      throw new BadRequestException('Attach up to four receipt images or PDF files to one message.');
    }
    let totalBytes = 0;
    return raw.map((item: CaseAttachmentInput) => {
      const fileName = String(item?.fileName || 'customer-upload').trim().replace(/[^a-zA-Z0-9._ ()-]/g, '_').slice(0, 120) || 'customer-upload';
      const mimeType = String(item?.mimeType || '').toLowerCase();
      const dataBase64 = String(item?.dataBase64 || '');
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new BadRequestException('Only JPEG, PNG, WebP images and PDF receipts are supported.');
      }
      if (!dataBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
        throw new BadRequestException('An uploaded receipt could not be read. Please choose it again.');
      }
      const contentBytes = Buffer.from(dataBase64, 'base64');
      if (!contentBytes.length || contentBytes.length > MAX_ATTACHMENT_BYTES) {
        throw new BadRequestException('Each receipt file must be 4 MB or smaller.');
      }
      totalBytes += contentBytes.length;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        throw new BadRequestException('All attachments together must be 8 MB or smaller.');
      }
      return { fileName, mimeType: mimeType as PreparedAttachment['mimeType'], dataBase64, contentBytes };
    });
  }

  async listCases(authUser: any) {
    const customer = await this.resolveCustomer(authUser);
    const cases = await this.prisma.customerAiCase.findMany({
      where: { customerId: customer.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, reference: true, subject: true, category: true, status: true, createdAt: true, updatedAt: true },
    });
    return { customerId: customer.id, cases };
  }

  async getCase(caseId: string, authUser: any) {
    const customer = await this.resolveCustomer(authUser);
    if (!caseId || caseId.length > 80) throw new NotFoundException('BALMZ AI case not found.');
    const supportCase = await this.prisma.customerAiCase.findFirst({
      where: { id: caseId, customerId: customer.id },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 100 },
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
        },
      },
    });
    if (!supportCase) throw new NotFoundException('BALMZ AI case not found.');
    return { customerId: customer.id, supportCase };
  }

  async chat(message: string, authUser: any, caseId?: string, rawAttachments?: unknown, category?: string) {
    const customer = await this.resolveCustomer(authUser);
    const attachments = this.prepareAttachments(rawAttachments);
    const text = String(message || '').trim().slice(0, 4000);
    if (!text && !attachments.length) throw new BadRequestException('Enter a message or attach a receipt.');

    let supportCase: any;
    if (caseId) {
      supportCase = await this.prisma.customerAiCase.findFirst({
        where: { id: caseId, customerId: customer.id },
        select: { id: true, reference: true, subject: true, category: true, status: true },
      });
      if (!supportCase) throw new NotFoundException('BALMZ AI case not found.');
    } else {
      const subject = (text || 'Receipt review and customer complaint').replace(/\s+/g, ' ').slice(0, 180);
      supportCase = await this.prisma.customerAiCase.create({
        data: {
          customerId: customer.id,
          reference: this.caseReference(),
          subject,
          category: String(category || 'GENERAL').toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 40) || 'GENERAL',
          status: 'OPEN',
        },
        select: { id: true, reference: true, subject: true, category: true, status: true },
      });
    }

    await this.prisma.customerAiCaseMessage.create({
      data: {
        caseId: supportCase.id,
        customerId: customer.id,
        role: 'user',
        content: text || 'Please review the receipt I attached and help me resolve the issue.',
      },
    });
    for (const attachment of attachments) {
      await this.prisma.customerAiCaseAttachment.create({
        data: {
          caseId: supportCase.id,
          customerId: customer.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          contentBytes: attachment.contentBytes,
          size: attachment.contentBytes.length,
        },
      });
    }

    const conversation = await this.prisma.customerAiCaseMessage.findMany({
      where: { caseId: supportCase.id, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    });
    const transcript = conversation.reverse()
      .map((item: any) => (item.role === 'assistant' ? 'BALMZ AI' : 'Customer') + ': ' + item.content)
      .join('\n');
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      const reply = 'BALMZ AI support is not connected to its AI provider right now. Your message has been saved under case ' + supportCase.reference + '. Please contact PWFB support and quote this reference.';
      await this.prisma.customerAiCaseMessage.create({
        data: { caseId: supportCase.id, customerId: customer.id, role: 'assistant', content: reply },
      });
      await this.prisma.customerAiCase.update({ where: { id: supportCase.id }, data: { updatedAt: new Date() } });
      return {
        assistant: 'BALMZ AI',
        configured: false,
        reply,
        customerId: customer.id,
        caseId: supportCase.id,
        caseReference: supportCase.reference,
        status: supportCase.status,
      };
    }

    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Customer';
    const instructions = 'You are BALMZ AI, the private customer-support assistant inside PWFB Microfinance. You are assisting only ' + customerName + ', Customer ID ' + customer.id + ', in case ' + supportCase.reference + '. Treat this case as belonging only to this one authenticated customer. Do not reveal, infer or mix another customer data or case. Help explain deposits, withdrawals, transfers, savings, loans, repayments, account access and how to use PWFB. Carefully inspect uploaded receipts and identify visible transaction date, amount, reference and recipient where present; distinguish what the receipt visibly says from what PWFB ledger has verified. Never invent a transaction status, balance, reference, fee or policy. Never claim a complaint is resolved, a payment is successful, or a balance is changed unless the PWFB system has explicitly confirmed it; this AI has read-only access. For a complaint that needs ledger access, reversal, correction, staff action or identity verification, explain the next safe step and quote the case reference so PWFB support can investigate. Never ask for PINs, passwords, OTPs, full card numbers, bank credentials or recovery secrets. Ask the customer to redact sensitive numbers before sharing documents. Keep replies practical and clear.';

    const inputContent: any[] = [{
      type: 'input_text',
      text: 'Customer ID: ' + customer.id + '\nCase reference: ' + supportCase.reference + '\nCase subject: ' + supportCase.subject + '\nConversation history:\n' + transcript + '\n\nRespond to the latest message and attached evidence.',
    }];
    for (const attachment of attachments) {
      const dataUrl = 'data:' + attachment.mimeType + ';base64,' + attachment.dataBase64;
      if (attachment.mimeType === 'application/pdf') {
        inputContent.push({ type: 'input_file', filename: attachment.fileName, file_data: dataUrl });
      } else {
        inputContent.push({ type: 'input_image', image_url: dataUrl });
      }
    }

    let response: Response;
    try {
      response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({
          model: process.env.BALMZ_AI_MODEL || 'gpt-5.6',
          instructions,
          input: [{ role: 'user', content: inputContent }],
        }),
      });
    } catch {
      return this.providerUnavailable(customer.id, supportCase);
    }
    if (!response.ok) {
      await response.text();
      return this.providerUnavailable(customer.id, supportCase);
    }

    const payload: any = await response.json();
    const reply = typeof payload.output_text === 'string'
      ? payload.output_text
      : (payload.output || []).flatMap((item: any) => item.content || []).map((item: any) => item.text).filter(Boolean).join('\n');
    const finalReply = reply.trim() || ('I could not produce a complete answer. Your case reference is ' + supportCase.reference + '; please try again.');

    await this.prisma.customerAiCaseMessage.create({
      data: { caseId: supportCase.id, customerId: customer.id, role: 'assistant', content: finalReply },
    });
    await this.prisma.customerAiCase.update({ where: { id: supportCase.id }, data: { updatedAt: new Date() } });

    return {
      assistant: 'BALMZ AI',
      configured: true,
      reply: finalReply,
      customerId: customer.id,
      caseId: supportCase.id,
      caseReference: supportCase.reference,
      status: supportCase.status,
    };
  }
}
