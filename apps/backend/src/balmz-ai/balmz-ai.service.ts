import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalmzAiService {
  constructor(private readonly prisma: PrismaService) {}

  private async operationalSnapshot() {
    const [customers, staff, loans, savings, transactions, repayments] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.staff.count(),
      this.prisma.loan.count(),
      this.prisma.savings.count(),
      this.prisma.transaction.count(),
      this.prisma.repayment.count(),
    ]);

    const [negativeSavings, negativeLoans, negativeTransactions, negativeRepayments] = await Promise.all([
      this.prisma.savings.count({ where: { amount: { lt: 0 } } }),
      this.prisma.loan.count({ where: { amount: { lt: 0 } } }),
      this.prisma.transaction.count({ where: { amount: { lt: 0 } } }),
      this.prisma.repayment.count({ where: { amount: { lt: 0 } } }),
    ]);

    return {
      counts: { customers, staff, loans, savings, transactions, repayments },
      anomalies: { negativeSavings, negativeLoans, negativeTransactions, negativeRepayments },
      generatedAt: new Date().toISOString(),
    };
  }

  async diagnose() {
    const snapshot = await this.operationalSnapshot();
    const findings: Array<{ severity: 'critical' | 'warning' | 'info'; title: string; detail: string; fixable: boolean }> = [];

    if (snapshot.anomalies.negativeSavings) findings.push({ severity: 'critical', title: 'Negative savings amounts detected', detail: `${snapshot.anomalies.negativeSavings} savings record(s) have a negative amount. Financial records must not be silently changed by AI; review and approve the correction.` , fixable: false });
    if (snapshot.anomalies.negativeLoans) findings.push({ severity: 'critical', title: 'Negative loan amounts detected', detail: `${snapshot.anomalies.negativeLoans} loan record(s) have a negative amount.`, fixable: false });
    if (snapshot.anomalies.negativeTransactions) findings.push({ severity: 'critical', title: 'Negative transaction amounts detected', detail: `${snapshot.anomalies.negativeTransactions} transaction record(s) have a negative amount.`, fixable: false });
    if (snapshot.anomalies.negativeRepayments) findings.push({ severity: 'critical', title: 'Negative repayment amounts detected', detail: `${snapshot.anomalies.negativeRepayments} repayment record(s) have a negative amount.`, fixable: false });
    if (!findings.length) findings.push({ severity: 'info', title: 'No basic financial data anomalies detected', detail: 'BALMZ AI checked the core operational tables and found no negative financial amounts.', fixable: false });

    return { assistant: 'BALMZ AI', snapshot, findings };
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

  async chat(message: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        assistant: 'BALMZ AI',
        configured: false,
        reply: 'BALMZ AI is connected to the PWFB admin system, but the AI model key has not been configured on the backend yet. I can still run the built-in system diagnostics.',
        diagnostics: await this.diagnose(),
      };
    }

    const snapshot = await this.operationalSnapshot();
    const model = process.env.BALMZ_AI_MODEL || 'gpt-5.6-luna';
    const system = `You are BALMZ AI, the internal operations assistant for PWFB Microfinance. You help the Super Admin diagnose application and operational mistakes. Be precise, concise and conservative. Never invent financial records. Never instruct the system to silently alter financial records. For financial corrections, identify the exact problem and require explicit administrator approval before any change. Current operational snapshot: ${JSON.stringify(snapshot)}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: `${system}\n\nAdmin request: ${message}` }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`BALMZ AI provider error: ${detail.slice(0, 300)}`);
    }

    const payload = await response.json();
    return { assistant: 'BALMZ AI', configured: true, reply: this.extractText(payload) || 'BALMZ AI returned no text.', diagnostics: { snapshot } };
  }

  async repairCheck() {
    return {
      assistant: 'BALMZ AI',
      mode: 'safe-repair',
      message: 'BALMZ AI will not silently change money, balances, loans, repayments, or customer records. It can detect the problem and prepare a correction for explicit Super Admin approval.',
      diagnostics: await this.diagnose(),
    };
  }
}
