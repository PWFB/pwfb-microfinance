import { Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class CustomerAiService {
  async chat(message: string, customer: any) {
    const apiKey = process.env.OPENAI_API_KEY;
    const safeContext = {
      name: [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Customer',
      customerId: customer?.id,
    };

    if (!apiKey) {
      return {
        assistant: 'BALMZ AI',
        configured: false,
        reply: 'BALMZ AI is available, but the AI service has not been configured yet. Please contact PWFB support for assistance.',
      };
    }

    const model = process.env.BALMZ_AI_MODEL || 'gpt-5.6';
    const system = `You are BALMZ AI, the customer support assistant inside PWFB Microfinance. Help customers understand PWFB services such as deposits, withdrawals, transfers, savings, loans, repayments, account security and transaction history. Be friendly and concise. Never ask for or reveal passwords, PINs, OTPs, full card numbers, bank credentials, or authentication secrets. Never claim a transaction succeeded unless the PWFB system confirms it. Never invent balances, loan status, fees, dates or policies. If a customer wants to perform a financial action, direct them to the relevant secure PWFB screen rather than asking them to send sensitive credentials in chat. If you cannot verify something, tell them to contact PWFB support. Current customer context is limited to: ${JSON.stringify(safeContext)}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: `${system}\n\nCustomer question: ${message}` }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new ServiceUnavailableException(`BALMZ AI provider error: ${detail.slice(0, 300)}`);
    }

    const payload: any = await response.json();
    const reply = typeof payload.output_text === 'string'
      ? payload.output_text
      : (payload.output || []).flatMap((item: any) => item.content || []).map((item: any) => item.text).filter(Boolean).join('\n');

    return { assistant: 'BALMZ AI', configured: true, reply: reply || 'I could not produce a response. Please try again.' };
  }
}
