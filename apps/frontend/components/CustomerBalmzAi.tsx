'use client';

import { FormEvent, useState } from 'react';
import { apiRequest } from '../lib/api';

type Message = { role: 'user' | 'ai'; text: string };

const suggestions = [
  'How can I make a deposit?',
  'How do I apply for a loan?',
  'How can I check my transactions?',
  'How do I transfer money?',
];

export default function CustomerBalmzAi() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hi! I’m BALMZ AI. Ask me anything about your PWFB account, deposits, savings, loans, repayments, transfers or how to use the app.' },
  ]);

  async function send(text = input) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const result = await apiRequest('/customer-ai/chat', { method: 'POST', body: JSON.stringify({ message: question }) });
      setMessages((current) => [...current, { role: 'ai', text: result.reply || 'I could not answer that right now. Please try again.' }]);
    } catch (error: any) {
      setMessages((current) => [...current, { role: 'ai', text: error?.message || 'I’m having trouble connecting. Please try again.' }]);
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); send(); }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open BALMZ AI" className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-[#064d25] px-4 py-3 text-sm font-bold text-white shadow-xl ring-2 ring-white lg:bottom-6 lg:right-6"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">✦</span>BALMZ AI</button>
    {open && <div className="fixed inset-0 z-[100] bg-black/30" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="BALMZ AI customer assistant" onClick={(event) => event.stopPropagation()} className="absolute bottom-0 right-0 flex h-[min(720px,92vh)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[680px] sm:w-[390px] sm:rounded-3xl">
        <header className="flex items-center justify-between bg-[#064d25] px-5 py-4 text-white"><div><div className="flex items-center gap-2 font-bold"><span className="rounded-full bg-white/15 px-2 py-1">✦</span>BALMZ AI</div><p className="mt-0.5 text-[11px] text-emerald-100/80">PWFB Customer Assistant</p></div><button type="button" onClick={() => setOpen(false)} className="text-2xl text-white/80" aria-label="Close">×</button></header>
        <div className="border-b border-slate-100 bg-slate-50 p-3"><p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Try asking</p><div className="flex gap-2 overflow-x-auto pb-1">{suggestions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => send(item)} className="shrink-0 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800">{item}</button>)}</div></div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[86%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>{message.text}</div></div>)}{busy && <div className="text-xs text-slate-400">BALMZ AI is thinking…</div>}</div>
        <div className="border-t border-slate-100 p-3"><form onSubmit={submit} className="flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} maxLength={2000} placeholder="Ask BALMZ AI…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-emerald-500" /><button type="submit" disabled={busy || !input.trim()} className="rounded-xl bg-[#064d25] px-4 text-sm font-bold text-white disabled:opacity-40">Send</button></form><p className="mt-2 text-center text-[10px] text-slate-400">Never share your PIN, password or OTP in chat.</p></div>
      </section>
    </div>}
  </>;
}
