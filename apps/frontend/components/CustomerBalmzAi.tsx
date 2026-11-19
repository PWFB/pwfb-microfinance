'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiRequest, apiUpload } from '../lib/api';

type Message = { role: 'user' | 'assistant'; text: string; caseReference?: string | null };
type SupportCase = { id: string; reference: string; subject: string; status: string };
const welcome: Message = { role: 'assistant', text: 'Hi! I’m BALMZ AI. Ask about your PWFB account, savings, deposits, loans or transfers. You can also report a problem and attach your payment receipt for review.' };
const receiptTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const maxReceiptBytes = 6 * 1024 * 1024;
const suggestions = ['How can I make a deposit?', 'How do I apply for a loan?', 'How can I check my transactions?', 'I need help with a payment.'];

export default function CustomerBalmzAi() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [customer, setCustomer] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [complaint, setComplaint] = useState(false);
  const [subject, setSubject] = useState('Payment / transaction complaint');
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [context, history, caseList] = await Promise.all([
          apiRequest('/customer-ai/context'),
          apiRequest('/customer-ai/conversations'),
          apiRequest('/customer-ai/cases'),
        ]);
        if (!active) return;
        setCustomer(context);
        setCases(Array.isArray(caseList?.cases) ? caseList.cases : []);
        const latest = Array.isArray(history?.conversations) ? history.conversations[0] : null;
        if (latest?.id) {
          const detail = await apiRequest(`/customer-ai/conversations/${encodeURIComponent(latest.id)}`);
          if (!active) return;
          setConversationId(latest.id);
          const restored = (detail?.messages || []).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            text: m.content || '',
            caseReference: m.caseReference || null,
          })) as Message[];
          setMessages(restored.length ? restored : [welcome]);
          if (Array.isArray(detail?.cases)) setCases(detail.cases);
        } else {
          setConversationId(null);
          setMessages([welcome]);
        }
      } catch (e: any) {
        if (active) setError(e?.message || 'Unable to load your BALMZ AI support workspace.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [open]);

  function chooseReceipt(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null;
    setError('');
    if (!selected) return;
    if (!receiptTypes.includes(selected.type)) {
      setError('Choose a JPG, PNG, WEBP image or PDF receipt.');
      event.target.value = '';
      return;
    }
    if (!selected.size || selected.size > maxReceiptBytes) {
      setError('The receipt must be 6 MB or smaller.');
      event.target.value = '';
      return;
    }
    setFile(selected);
    setComplaint(true);
  }

  async function send(text = input) {
    const question = text.trim();
    if ((!question && !file) || busy) return;
    const attachment = file;
    const message = question || 'Please review my uploaded receipt and help with my complaint.';
    setInput('');
    setError('');
    setMessages((items) => [...items, { role: 'user', text: attachment ? `${message}\nAttached: ${attachment.name}` : message }]);
    setBusy(true);
    try {
      const form = new FormData();
      form.append('message', message);
      if (conversationId) form.append('conversationId', conversationId);
      form.append('isComplaint', String(complaint || Boolean(attachment)));
      if (complaint || attachment) form.append('subject', subject.trim() || 'Customer support request');
      if (attachment) form.append('attachment', attachment, attachment.name);
      const result = await apiUpload('/customer-ai/chat', form);
      if (result?.conversationId) setConversationId(result.conversationId);
      setMessages((items) => [...items, {
        role: 'assistant',
        text: result?.reply || 'I could not answer right now. Please try again.',
        caseReference: result?.case?.reference || null,
      }]);
      if (result?.case?.reference) {
        setCases((items) => [result.case, ...items.filter((item) => item.reference !== result.case.reference)]);
      }
      setFile(null);
      setComplaint(false);
      if (fileInput.current) fileInput.current.value = '';
    } catch (e: any) {
      setMessages((items) => [...items, { role: 'assistant', text: e?.message || 'I could not send your message. Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function newChat() {
    if (busy) return;
    setConversationId(null);
    setMessages([welcome]);
    setInput('');
    setFile(null);
    setComplaint(false);
    setError('');
    if (fileInput.current) fileInput.current.value = '';
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open BALMZ AI" className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full bg-[#064d25] px-4 py-3 text-sm font-bold text-white shadow-xl ring-2 ring-white lg:bottom-6 lg:right-6">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">✦</span>BALMZ AI
    </button>
    {open && <div className="fixed inset-0 z-[100] bg-black/30" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="BALMZ AI customer assistant" onClick={(event) => event.stopPropagation()} className="absolute bottom-0 right-0 flex h-[min(760px,94vh)] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:bottom-4 sm:right-4 sm:h-[700px] sm:w-[420px] sm:rounded-3xl">
        <header className="bg-[#064d25] px-5 py-4 text-white">
          <div className="flex items-center justify-between gap-3">
            <div><div className="flex items-center gap-2 font-bold"><span className="rounded-full bg-white/15 px-2 py-1">✦</span>BALMZ AI</div><p className="mt-0.5 text-[11px] text-emerald-100/80">Private PWFB customer support</p></div>
            <div className="flex items-center gap-3"><button type="button" onClick={newChat} disabled={busy} className="text-xs font-semibold text-emerald-100 underline underline-offset-4 disabled:opacity-40">New chat</button><button type="button" onClick={() => setOpen(false)} className="text-2xl text-white/80" aria-label="Close">×</button></div>
          </div>
          <div className="mt-3 rounded-xl bg-white/10 px-3 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-100/80">Your client ID</p>
            <p className="mt-0.5 break-all font-mono text-xs font-bold">{customer?.customerId || (loading ? 'Loading your customer profile…' : 'Customer profile unavailable')}</p>
            <p className="mt-0.5 text-[10px] text-emerald-100/80">This chat and your support cases belong to this customer account only.</p>
          </div>
        </header>
        <div className="border-b border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Try asking</p><button type="button" onClick={() => setComplaint((v) => !v)} disabled={busy} className="text-[11px] font-bold text-emerald-800 underline underline-offset-4">{complaint ? 'Close complaint form' : 'Report a problem'}</button></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{suggestions.map((item) => <button key={item} type="button" disabled={busy || loading} onClick={() => void send(item)} className="shrink-0 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-medium text-emerald-800">{item}</button>)}</div>
        </div>
        {(complaint || file) && <div className="border-b border-amber-100 bg-amber-50 p-3"><p className="text-xs font-bold text-amber-900">Open a support complaint</p><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={160} placeholder="Complaint subject" className="mt-2 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-amber-500" /><p className="mt-1 text-[10px] leading-4 text-amber-800">Attach a receipt or screenshot so BALMZ AI can inspect it. A receipt alone does not prove a payment settled.</p></div>}
        {cases.length > 0 && <div className="border-b border-slate-100 bg-white px-3 py-2"><p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">Your support cases</p><div className="flex gap-2 overflow-x-auto">{cases.slice(0,5).map((item) => <div key={item.id || item.reference} className="shrink-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5"><p className="font-mono text-[10px] font-bold text-emerald-800">{item.reference}</p><p className="text-[9px] text-slate-500">{String(item.status || 'OPEN').replace('_',' ')}</p></div>)}</div></div>}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {loading && <div className="text-xs text-slate-400">Loading your private support history…</div>}
          {messages.map((message, index) => <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3 py-2.5 text-sm leading-5 ${message.role === 'user' ? 'rounded-br-md bg-emerald-600 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'}`}>{message.text}{message.caseReference && <div className="mt-2 rounded-lg border border-emerald-200 bg-white/80 px-2.5 py-2 text-[11px] text-emerald-900"><p className="font-semibold">Complaint reference</p><p className="mt-0.5 break-all font-mono font-bold">{message.caseReference}</p><p className="mt-1 text-[10px]">Keep this reference when contacting PWFB staff.</p></div>}</div></div>)}
          {busy && <div className="text-xs text-slate-400">BALMZ AI is reviewing your request…</div>}
        </div>
        {error && <div role="alert" className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <div className="border-t border-slate-100 p-3">
          {file && <div className="mb-2 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"><span className="min-w-0 truncate">Receipt attached: {file.name}</span><button type="button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }} className="ml-3 font-bold">Remove</button></div>}
          <form onSubmit={submit} className="flex items-end gap-2">
            <input ref={fileInput} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
              const selected = event.target.files?.[0] || null; setError('');
              if (!selected) return;
              if (!receiptTypes.includes(selected.type)) { setError('Choose a JPG, PNG, WEBP image or PDF receipt.'); event.target.value = ''; return; }
              if (!selected.size || selected.size > maxReceiptBytes) { setError('The receipt must be 6 MB or smaller.'); event.target.value = ''; return; }
              setFile(selected); setComplaint(true);
            }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy || loading || !customer} aria-label="Attach receipt" title="Attach receipt" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-emerald-800 disabled:opacity-40">＋</button>
            <input value={input} onChange={(event) => setInput(event.target.value)} disabled={busy || loading || !customer} maxLength={3000} placeholder="Ask BALMZ AI or describe your complaint…" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500" />
            <button type="submit" disabled={busy || loading || !customer || (!input.trim() && !file)} className="rounded-xl bg-[#064d25] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Send</button>
          </form>
          <p className="mt-2 text-center text-[10px] text-slate-400">Never share your PIN, password or OTP. Chat does not change financial records.</p>
        </div>
      </section>
    </div>}
  </>;
}
