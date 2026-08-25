'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiUpload } from '../../../lib/api';

type Result = {
  status: 'VERIFIED' | 'FAILED' | 'REVIEW';
  confidence: number;
  message: string;
  extracted: { paymentStatus: string | null; amount: number | null; currency: string | null; reference: string | null; date: string | null; sender: string | null; receiver: string | null; bankOrProvider: string | null };
  databaseMatch: { matched: boolean; source: string | null; id: string | null; amount: number | null; status: string | null };
  reasons: string[];
};

function money(value: number | null, currency: string | null) {
  if (value == null) return '—';
  return `${currency || 'NGN'} ${Number(value).toLocaleString('en-NG')}`;
}

export default function BalmzReceiptPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  function chooseFile(next: File | null) {
    setError('');
    setResult(null);
    setFile(next);
    if (next) setPreview(URL.createObjectURL(next)); else setPreview('');
  }

  async function verify() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const form = new FormData();
      form.append('receipt', file);
      const response = await apiUpload('/balmz-ai/receipts/verify', form);
      setResult(response);
    } catch (e: any) {
      setError(e?.message || 'Receipt verification failed.');
    } finally { setBusy(false); }
  }

  const statusClass = result?.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : result?.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">BALMZ AI</p><h1 className="text-2xl font-bold text-slate-900">Payment Receipt Verification</h1><p className="mt-1 text-sm text-slate-500">Upload a payment slip and let BALMZ AI inspect it and reconcile the visible payment details with PWFB records.</p></div>
          <Link href="/dashboard" className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700">Back</Link>
        </div>

        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Upload payment slip</h2>
            <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP or GIF · maximum 6 MB</p>
            <label className="mt-4 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center">
              {preview ? <img src={preview} alt="Uploaded payment receipt" className="max-h-64 max-w-full rounded-xl object-contain" /> : <><div className="text-4xl">🧾</div><strong className="mt-3 text-sm text-slate-800">Tap to select receipt</strong><span className="mt-1 text-xs text-slate-500">Upload the original payment slip or screenshot</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => chooseFile(e.target.files?.[0] || null)} />
            </label>
            {file && <p className="mt-3 truncate text-xs text-slate-500">Selected: {file.name}</p>}
            {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            <button type="button" onClick={verify} disabled={!file || busy} className="mt-4 w-full rounded-xl bg-[#087534] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'BALMZ AI is verifying…' : 'Verify payment receipt'}</button>
            <p className="mt-3 text-center text-[11px] text-slate-400">A receipt marked successful is not automatically accepted unless BALMZ AI can reconcile it with PWFB financial records.</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Verification result</h2>
            {!result ? <div className="flex min-h-56 items-center justify-center text-center text-sm text-slate-400">Upload a receipt to see the verification result.</div> : <div className="mt-4 space-y-4">
              <div className={`rounded-xl border p-4 ${statusClass}`}><div className="flex items-center justify-between gap-3"><strong className="text-lg">{result.status}</strong><span className="text-xs font-bold">{result.confidence}% confidence</span></div><p className="mt-1 text-sm">{result.message}</p></div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Amount</span><strong>{money(result.extracted.amount, result.extracted.currency)}</strong></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Payment status</span><strong className="capitalize">{result.extracted.paymentStatus || 'unknown'}</strong></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Reference</span><strong className="break-all">{result.extracted.reference || '—'}</strong></div>
                <div className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">Date</span><strong>{result.extracted.date || '—'}</strong></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">PWFB reconciliation</p><p className="mt-1 text-sm font-semibold">{result.databaseMatch.matched ? `Matched ${result.databaseMatch.source} record ${result.databaseMatch.id}` : 'No matching PWFB financial record found'}</p>{result.databaseMatch.amount != null && <p className="mt-1 text-xs text-slate-500">Recorded amount: {money(result.databaseMatch.amount, result.extracted.currency)}</p>}</div>
              <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">BALMZ AI findings</p><ul className="mt-2 space-y-2 text-sm text-slate-700">{result.reasons.map((reason, index) => <li key={index} className="rounded-lg bg-slate-50 p-2">• {reason}</li>)}</ul></div>
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}
