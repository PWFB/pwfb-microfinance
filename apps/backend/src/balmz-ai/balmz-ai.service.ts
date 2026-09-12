import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Severity = 'critical' | 'warning' | 'info';
type Finding = { severity: Severity; title: string; detail: string; fixable: boolean };
type AiProvider = 'openai' | 'gemini';

@Injectable()
export class BalmzAiService {
  constructor(private readonly prisma: PrismaService) {}

  private async operationalSnapshot() {
    const [customers, staff, loans, savings, transactions, repayments] = await Promise.all([
      this.prisma.customer.count(), this.prisma.staff.count(), this.prisma.loan.count(),
      this.prisma.savings.count(), this.prisma.transaction.count(), this.prisma.repayment.count(),
    ]);
    const [negativeSavings, negativeLoans, negativeTransactions, negativeRepayments] = await Promise.all([
      this.prisma.savings.count({ where: { amount: { lt: 0 } } }),
      this.prisma.loan.count({ where: { amount: { lt: 0 } } }),
      this.prisma.transaction.count({ where: { amount: { lt: 0 } } }),
      this.prisma.repayment.count({ where: { amount: { lt: 0 } } }),
    ]);
    return { counts: { customers, staff, loans, savings, transactions, repayments }, anomalies: { negativeSavings, negativeLoans, negativeTransactions, negativeRepayments }, generatedAt: new Date().toISOString() };
  }

  private async financialIntegrityAudit(): Promise<{ status: 'healthy' | 'warning' | 'critical'; checks: number; findings: Finding[] }> {
    const findings: Finding[] = [];
    const [cashbookNegative, collectionsNegative, payrollItems, periods, transactions, repayments, loans] = await Promise.all([
      this.prisma.cashbookEntry.count({ where: { amount: { lt: 0 } } }),
      this.prisma.dailyCollection.count({ where: { amount: { lt: 0 } } }),
      this.prisma.payrollItem.findMany({ select: { id: true, basicSalary: true, allowances: true, deductions: true, netSalary: true } }),
      this.prisma.financialPeriod.findMany({ select: { id: true, name: true, startDate: true, endDate: true } }),
      this.prisma.transaction.findMany({ select: { id: true, customerId: true, type: true, amount: true, description: true, createdAt: true } }),
      this.prisma.repayment.findMany({ select: { id: true, loanId: true, amount: true } }),
      this.prisma.loan.findMany({ select: { id: true, amount: true } }),
    ]);
    if (cashbookNegative) findings.push({ severity: 'critical', title: 'Negative cashbook amounts detected', detail: `${cashbookNegative} cashbook entr${cashbookNegative === 1 ? 'y' : 'ies'} have a negative amount.`, fixable: false });
    if (collectionsNegative) findings.push({ severity: 'critical', title: 'Negative collection amounts detected', detail: `${collectionsNegative} daily collection record(s) have a negative amount.`, fixable: false });
    const invalidPeriods = periods.filter((period) => period.endDate <= period.startDate);
    if (invalidPeriods.length) findings.push({ severity: 'critical', title: 'Invalid financial periods detected', detail: `${invalidPeriods.length} financial period(s) have an end date that is not after the start date.`, fixable: false });
    const futureTransactions = transactions.filter((row) => row.createdAt.getTime() > Date.now() + 5 * 60 * 1000);
    if (futureTransactions.length) findings.push({ severity: 'warning', title: 'Future-dated transactions detected', detail: `${futureTransactions.length} transaction(s) are dated more than five minutes in the future. Check device clocks or imported records.`, fixable: false });
    const fingerprintCounts = new Map<string, number>();
    for (const row of transactions) {
      const fingerprint = [row.customerId, row.type, row.amount, row.description || '', row.createdAt.toISOString()].join('|');
      fingerprintCounts.set(fingerprint, (fingerprintCounts.get(fingerprint) || 0) + 1);
    }
    const duplicateTransactionGroups = [...fingerprintCounts.values()].filter((count) => count > 1).length;
    if (duplicateTransactionGroups) findings.push({ severity: 'warning', title: 'Potential duplicate transactions detected', detail: `${duplicateTransactionGroups} exact transaction fingerprint group(s) contain duplicates. Review before reversing anything.`, fixable: false });
    const repaymentTotals = new Map<string, number>();
    for (const repayment of repayments) repaymentTotals.set(repayment.loanId, (repaymentTotals.get(repayment.loanId) || 0) + repayment.amount);
    const loanMap = new Map(loans.map((loan) => [loan.id, loan.amount]));
    const repaymentOverPrincipal = [...repaymentTotals.entries()].filter(([loanId, total]) => (loanMap.get(loanId) ?? 0) >= 0 && total > (loanMap.get(loanId) ?? 0) + 0.01).length;
    if (repaymentOverPrincipal) findings.push({ severity: 'warning', title: 'Repayments exceed recorded loan principal', detail: `${repaymentOverPrincipal} loan(s) have cumulative repayments above their recorded principal. This may be valid when interest or fees are included, so review the loan terms before correction.`, fixable: false });
    const payrollMismatches = payrollItems.filter((item) => Math.abs((item.basicSalary + item.allowances - item.deductions) - item.netSalary) > 0.01);
    if (payrollMismatches.length) findings.push({ severity: 'critical', title: 'Payroll totals do not reconcile', detail: `${payrollMismatches.length} payroll item(s) have net salary different from basic salary + allowances - deductions.`, fixable: false });
    if (!findings.length) findings.push({ severity: 'info', title: 'Financial integrity audit passed', detail: 'BALMZ AI found no basic financial integrity anomalies across the checked operational tables.', fixable: false });
    const status = findings.some((f) => f.severity === 'critical') ? 'critical' : findings.some((f) => f.severity === 'warning') ? 'warning' : 'healthy';
    return { status, checks: 9, findings };
  }

  async diagnose() {
    const snapshot = await this.operationalSnapshot();
    const basicFindings: Finding[] = [];
    if (snapshot.anomalies.negativeSavings) basicFindings.push({ severity: 'critical', title: 'Negative savings amounts detected', detail: `${snapshot.anomalies.negativeSavings} savings record(s) have a negative amount. Financial records must not be silently changed by AI; review and approve the correction.`, fixable: false });
    if (snapshot.anomalies.negativeLoans) basicFindings.push({ severity: 'critical', title: 'Negative loan amounts detected', detail: `${snapshot.anomalies.negativeLoans} loan record(s) have a negative amount.`, fixable: false });
    if (snapshot.anomalies.negativeTransactions) basicFindings.push({ severity: 'critical', title: 'Negative transaction amounts detected', detail: `${snapshot.anomalies.negativeTransactions} transaction record(s) have a negative amount.`, fixable: false });
    if (snapshot.anomalies.negativeRepayments) basicFindings.push({ severity: 'critical', title: 'Negative repayment amounts detected', detail: `${snapshot.anomalies.negativeRepayments} repayment record(s) have a negative amount.`, fixable: false });
    const audit = await this.financialIntegrityAudit();
    const findings = [...basicFindings, ...audit.findings.filter((finding) => finding.severity !== 'info')];
    const status = findings.some((f) => f.severity === 'critical') ? 'critical' : findings.some((f) => f.severity === 'warning') ? 'warning' : 'healthy';
    if (!findings.length) findings.push({ severity: 'info', title: 'No financial data anomalies detected', detail: 'BALMZ AI completed the basic anomaly scan and deeper financial integrity checks with no findings.', fixable: false });
    return { assistant: 'BALMZ AI', status, snapshot, integrityAudit: audit, findings };
  }

  private extractOpenAiText(payload: any): string {
    if (typeof payload?.output_text === 'string') return payload.output_text;
    const parts: string[] = [];
    for (const item of payload?.output || []) for (const content of item?.content || []) if (typeof content?.text === 'string') parts.push(content.text);
    return parts.join('\n').trim();
  }

  private extractGeminiText(payload: any): string {
    if (typeof payload?.output_text === 'string') return payload.output_text.trim();
    const parts: string[] = [];
    for (const candidate of payload?.candidates || []) for (const part of candidate?.content?.parts || []) if (typeof part?.text === 'string') parts.push(part.text);
    for (const item of payload?.output || []) for (const content of item?.content || []) if (typeof content?.text === 'string') parts.push(content.text);
    for (const step of payload?.steps || []) for (const content of step?.content || []) if (typeof content?.text === 'string') parts.push(content.text);
    return parts.join('\n').trim();
  }

  private cleanGeminiModel(value: string): string {
    let model = value.trim().replace(/^['"]|['"]$/g, '');
    model = model.replace(/^=+/, '');
    model = model.replace(/^https?:\/\/[^/]+\/v1beta\//i, '');
    model = model.replace(/^.*\/models\//i, '');
    model = model.replace(/^models\//i, '');
    model = model.replace(/:generateContent$/i, '');
    return model.trim();
  }

  private async callOpenAi(message: string, system: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    const model = process.env.BALMZ_AI_MODEL || 'gpt-5.6-luna';
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: `${system}\n\nAdmin request: ${message}` }),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 300)}`);
    return this.extractOpenAiText(await response.json());
  }

  private async callGemini(message: string, system: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    const configuredModel = this.cleanGeminiModel(process.env.GEMINI_MODEL || 'gemini-3.7-flash');
    const models = [...new Set([configuredModel, 'gemini-3.7-flash'])].filter(Boolean);
    const errors: string[] = [];
    for (const model of models) {
      try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({ model, system_instruction: system, input: message }),
        });
        if (!response.ok) {
          errors.push(`${model} ${response.status}: ${(await response.text()).slice(0, 300)}`);
          continue;
        }
        const payload = await response.json();
        const reply = this.extractGeminiText(payload);
        if (reply) return reply;
        errors.push(`${model}: Gemini returned no text`);
      } catch (error: any) {
        errors.push(`${model}: ${error?.message || 'provider error'}`);
      }
    }
    throw new Error(`Gemini ${errors.join(' | ')}`);
  }

  private providerOrder(): AiProvider[] {
    const configured = (process.env.BALMZ_AI_PROVIDER || 'auto').trim().toLowerCase();
    if (configured === 'gemini') return ['gemini', 'openai'];
    if (configured === 'openai') return ['openai', 'gemini'];
    return ['openai', 'gemini'];
  }

  async chat(message: string) {
    const snapshot = await this.operationalSnapshot();
    const system = `You are BALMZ AI, the internal operations assistant for PWFB Microfinance. You help the Super Admin diagnose application and operational mistakes. Be precise, concise and conservative. Never invent financial records. Never instruct the system to silently alter financial records. For financial corrections, identify the exact problem and require explicit administrator approval before any change. Current operational snapshot: ${JSON.stringify(snapshot)}`;
    const providers = { openai: Boolean(process.env.OPENAI_API_KEY?.trim()), gemini: Boolean(process.env.GEMINI_API_KEY?.trim()) };
    if (!providers.openai && !providers.gemini) return { assistant: 'BALMZ AI', configured: false, provider: null, providers, reply: 'BALMZ AI is connected to the PWFB admin system, but no AI model key has been configured on the backend yet. I can still run the built-in system diagnostics.', diagnostics: await this.diagnose() };
    const errors: string[] = [];
    for (const provider of this.providerOrder()) {
      if (!providers[provider]) continue;
      try {
        const reply = provider === 'openai' ? await this.callOpenAi(message, system) : await this.callGemini(message, system);
        return { assistant: 'BALMZ AI', configured: true, provider, providers, reply: reply || 'BALMZ AI returned no text.', diagnostics: { snapshot } };
      } catch (error: any) {
        errors.push(`${provider}: ${error?.message || 'provider error'}`);
      }
    }
    throw new ServiceUnavailableException(`BALMZ AI providers unavailable. ${errors.join(' | ')}`);
  }

  async repairCheck() {
    return {
      assistant: 'BALMZ AI', mode: 'safe-repair',
      message: 'BALMZ AI will not silently change money, balances, loans, repayments, or customer records. It can detect the problem and prepare a correction for explicit Super Admin approval.',
      diagnostics: await this.diagnose(),
    };
  }
}
