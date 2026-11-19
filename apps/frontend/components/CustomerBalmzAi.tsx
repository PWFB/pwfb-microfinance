'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api';

type Message = { role: 'user' | 'ai'; text: string; attachments?: string[] };
type CaseSummary = { id: string; reference: string; subject: string; category: string; status: string; updatedAt: string };
type PendingAttachment = { fileName: string; mimeType: string; dataBase64: string };

const suggestions = [
  'Help me understand my savings or deposit.',
  'I cannot see a transaction in my history.',
  'Please check this receipt or payment complaint.',
  'How can I make a loan repayment?',
];

const greeting: Message = {
  role: 'ai',
  text: 'Hi! I’m BALMZ AI. I can help explain PWFB services and review a receipt or complaint. Your conversation is kept in your own customer case. Never share your PIN, password or OTP.',
};

function readFile(file: File): Promise<PendingAttachment> {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) throw new Error('Choose a JPEG, PNG, WebP image or PDF receipt.');
  if (file.size < 1 || file.size > 4 * 1024 * 1024) throw new Error('Each attachment must be 4 MB or smaller.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const dataBase64 = result.split(',')[1] || '';
      if (!dataBase64) reject(new Error('This receipt could not be read. Please choose it again.'));
      else resolve({ fileName: file.name.slice(0, 120), mimeType: file.type, dataBase64 });
    };
    reader.onerror = () => reject(new Error('This receipt could not be read.'));
    reader.readAsDataURL(file);
  });
}

export default function CustomerBalmzAi() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseId, setCaseId] = useState('');
  const [caseReference, setCaseReference] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    apiRequest('/customer-ai/cases')
      .then((result) => {
        if (!active) return;
        setCustomerId(String(result?.customerId || ''));
        setCases(Array.isArray(result?.cases) ? result.cases : []);
      })
      .catch((failure) => {
        if (active) setError(failure instanceof Error ? failure.message : 'Unable to load your BALMZ AI cases.');
      });
    return () => { active = false; };
  }, [open]);

  async function openCase(id: string) {
    if (!id) {
      startNewCase();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/customer-ai/cases/' + encodeURIComponent(id));
      const supportCase = result?.supportCase;
      setCaseId(String(supportCase?.id || id));
      setCaseReference(String(supportCase?.reference || ''));
      setCustomerId(String(result?.customerId || customerId));
      const history = Array.isArray(supportCase?.messages) ? supportCase.messages : [];
      setMessages(history.map((item: any) => ({
        role: item.role === 'assistant' ? 'ai' : 'user',
        text: String(item.content || ''),
      })));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to open this customer case.');
    } finally {
      setBusy(false);
    }
  }

  function startNewCase() {
    setCaseId('');
    setCaseReference('');
    setMessages([greeting]);
    setAttachment(null);
    setInput('');
    setError('');
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    setError('');
    try {
      const ready = await readFile(file);
      setAttachment(ready);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to attach this receipt.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function send(text = input) {
    const question = text.trim() || (attachment ? 'Please review the receipt I attached and help me resolve the issue.' : '');
    if ((!question && !attachment) || busy) return;
    const submittedAttachment = attachment;
    setInput('');
    setError('');
    setMessages((current) => [...current, {
      role: 'user',
      text: question,
      attachments: submittedAttachment ? [submittedAttachment.fileName] : [],
    }]);
    setBusy(true);
    try {
      const result = await apiRequest('/customer-ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: question,
          caseId: caseId || undefined,
          attachments: submittedAttachment ? [submittedAttachment] : [],
          category: submittedAttachment ? 'RECEIPT_OR_TRANSACTION_COMPLAINT' : 'GENERAL',
        }),
      });
      setCaseId(String(result?.caseId || caseId));
      setCaseReference(String(result?.caseReference || caseReference));
      setCustomerId(String(result?.customerId || customerId));
      setMessages((current) => [...current, { role: 'ai', text: String(result?.reply || 'I could not complete that response. Please try again.') }]);
      setAttachment(null);
      const refreshed = await apiRequest('/customer-ai/cases');
      setCases(Array.isArray(refreshed?.cases) ? refreshed.cases : []);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : 'I’m having trouble connecting. Please try again.';
      setError(message);
      setMessages((current) => [...current, { role: 'ai', text: message }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open BALMZ AI" className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-[#064d25] px-4 py-3 text-sm font-bold text-white shadow-xl ring-2 ring-white lg:bottom-6 lg:right-6">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">✦</span>BALMZ AI
    </button>
    {open && <div className="fixed inset-0 z-[100] bg-black/30" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="BALMZ AI customer assistant" onClick={(event) => event.stopPropagation()} className="absolute bottom-0 right-0 flex h-[min(760px,94vh)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[700px] sm:w-[410px] sm:rounded-3xl">
        <header className="bg-[#064d25] px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div><div className="flex items-center gap-2 font-bold"><span className="rounded-full bg-white/15 px-2 py-1">✦</span>BALMZ AI</div><p className="mt-0.5 text-[11px] text-emerald-100/80">Private PWFB customer support</p></div>
            <button type="button" onClick={() => setOpen(false)} className="text-2xl text-white/80" aria-label="Close">×</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-emerald-100">
            {customerId && <span>Client ID: {customerId}</span>}
            {caseReference && <span>Case: {caseReference}</span>}
          </div>
        </header>

        <div className="border-b border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <select value={caseId} onChange={(event) => void openCase(event.target.value)} disabled={busy || !cases.length} aria-label="Your BALMZ AI cases" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
              <option value="">New chat / complaint</option>
              {cases.map((item) => <option key={item.id} value={item.id}>{item.reference} · {item.subject} · {item.status}</option>)}
            </select>
            <button type="button" onClick={startNewCase} disabled={busy} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">New</button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Each case is tied to your Client ID. Only your account can open its conversations and receipt uploads.</p>
        </div>

        <div className="border-b border-slate-100 bg-white p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Try asking</p>
          <div className="flex gap-2 overflow-x-auto pb-1">{suggestions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => void send(item)} className="shrink-0 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800 disabled:opacity-40">{item}</button>)}</div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>
              {message.text}
              {message.attachments?.map((name) => <p key={name} className="mt-2 border-t border-white/20 pt-2 text-[11px]">📎 {name}</p>)}
            </div>
          </div>)}
          {busy && <div className="text-xs text-slate-400">BALMZ AI is reviewing your request…</div>}
        </div>

        {error && <p role="alert" className="border-t border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</p>}
        <div className="border-t border-slate-100 p-3">
          {attachment && <div className="mb-2 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><span className="min-w-0 truncate">📎 {attachment.fileName}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="ml-2 font-bold">×</button></div>}
          <form onSubmit={submit} className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || Boolean(attachment)} aria-label="Attach receipt or complaint evidence" className="rounded-xl border border-slate-200 px-3 py-3 text-sm text-emerald-800 disabled:opacity-40">＋</button>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} disabled={busy} maxLength={4000} rows={2} placeholder="Ask a question or describe your complaint…" className="min-w-0 flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-500" />
            <button type="submit" disabled={busy || (!input.trim() && !attachment)} className="rounded-xl bg-[#064d25] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Send</button>
          </form>
          <p className="mt-2 text-center text-[10px] text-slate-400">Attach JPEG, PNG, WebP or PDF receipts (4 MB each). Never share your PIN, password or OTP.</p>
        </div>
      </section>
    </div>}
  </>;
}
