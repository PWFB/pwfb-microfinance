'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiRequest } from '../lib/api';

type Message = { role: 'admin' | 'ai'; text: string };
type Audit = { status?: 'healthy' | 'warning' | 'critical'; checks?: number; findings?: Array<{ severity: string; title: string; detail: string }> };

export default function BalmzAiPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Hello. I am BALMZ AI. I can inspect PWFB operations, explain errors and identify mistakes for the Super Admin.' },
  ]);
  const statusLabel = audit?.status === 'critical' ? 'CRITICAL' : audit?.status === 'warning' ? 'WARNING' : audit?.status === 'healthy' ? 'HEALTHY' : 'NOT RUN';
  const statusBackground = audit?.status === 'critical' ? '#fdecec' : audit?.status === 'warning' ? '#fff6e5' : '#e9f6ee';
  const statusText = audit?.status === 'critical' ? '#b42318' : audit?.status === 'warning' ? '#b54708' : '#087534';

  async function send(message = input) {
    const text = message.trim();
    if (!text || busy) return;
    setInput(''); setMessages((m) => [...m, { role: 'admin', text }]); setBusy(true);
    try {
      const result = await apiRequest('/balmz-ai/chat', { method: 'POST', body: JSON.stringify({ message: text }) });
      if (result?.diagnostics?.status) setAudit(result.diagnostics);
      setMessages((m) => [...m, { role: 'ai', text: result.reply || 'I could not produce a response.' }]);
    } catch (e: any) { setMessages((m) => [...m, { role: 'ai', text: e?.message || 'BALMZ AI could not reach the backend.' }]); }
    finally { setBusy(false); }
  }

  async function diagnose() {
    if (busy) return; setBusy(true);
    try {
      const result = await apiRequest('/balmz-ai/diagnose'); setAudit(result);
      const lines = (result.findings || []).map((x: any) => `${String(x.severity).toUpperCase()}: ${x.title} — ${x.detail}`);
      setMessages((m) => [...m, { role: 'ai', text: `Financial integrity status: ${String(result.status || 'healthy').toUpperCase()}\nChecks completed: ${result.integrityAudit?.checks || 0}\n\n${lines.join('\n') || 'No findings.'}` }]);
    } catch (e: any) { setMessages((m) => [...m, { role: 'ai', text: e?.message || 'System diagnostic failed.' }]); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Open BALMZ AI" style={{ position: 'fixed', right: 22, bottom: 22, zIndex: 80, border: 0, borderRadius: 999, padding: '13px 18px', background: '#087534', color: '#fff', fontWeight: 800, boxShadow: '0 10px 30px rgba(0,0,0,.18)', cursor: 'pointer' }}>✦ BALMZ AI</button>
    {open && <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.28)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setOpen(false)}>
      <aside onClick={(e) => e.stopPropagation()} style={{ width: 'min(430px, 100vw)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 35px rgba(0,0,0,.18)' }}>
        <header style={{ padding: 18, background: '#087534', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><strong style={{ fontSize: 18 }}>✦ BALMZ AI</strong><div style={{ fontSize: 11, opacity: .82 }}>PWFB Admin Intelligence</div></div><button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 0, color: '#fff', fontSize: 22 }}>×</button></header>
        <div style={{ padding: 12, display: 'flex', gap: 8, borderBottom: '1px solid #eee' }}><button onClick={diagnose} disabled={busy} style={{ flex: 1, padding: 9, borderRadius: 8, border: '1px solid #d0d5dd', background: '#fff' }}>Run financial audit</button><button onClick={() => send('Check the PWFB system for mistakes and explain what I should correct first.')} disabled={busy} style={{ flex: 1, padding: 9, borderRadius: 8, border: 0, background: '#f28c18', color: '#fff', fontWeight: 700 }}>Find mistakes</button></div>
        <Link href="/balmz-ai/receipt" onClick={() => setOpen(false)} style={{ margin: '12px 12px 0', display: 'block', borderRadius: 10, padding: '11px 12px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>🧾 Verify uploaded payment receipt →</Link>
        <div style={{ margin: '12px 12px 0', padding: '10px 12px', borderRadius: 10, background: statusBackground, color: statusText, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 800 }}><span>Financial Integrity</span><span>{statusLabel}{audit?.checks ? ` · ${audit.checks} checks` : ''}</span></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{messages.map((m, i) => <div key={i} style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'admin' ? 'flex-end' : 'flex-start' }}><div style={{ maxWidth: '88%', whiteSpace: 'pre-wrap', padding: '10px 12px', borderRadius: 12, background: m.role === 'admin' ? '#e9f6ee' : '#f5f7f6', color: '#202621', fontSize: 13, lineHeight: 1.45 }}>{m.text}</div></div>)}{busy && <div style={{ color: '#667085', fontSize: 12 }}>BALMZ AI is checking…</div>}</div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ padding: 12, borderTop: '1px solid #eee', display: 'flex', gap: 8 }}><input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask BALMZ AI…" style={{ flex: 1, minWidth: 0, padding: 11, border: '1px solid #d0d5dd', borderRadius: 9, outline: 0 }} /><button disabled={busy || !input.trim()} style={{ padding: '0 15px', border: 0, borderRadius: 9, background: '#087534', color: '#fff', fontWeight: 700 }}>Send</button></form>
      </aside>
    </div>}
  </>;
}
