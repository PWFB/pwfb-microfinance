'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate?: string;
  method?: string;
  notes?: string;
  loan?: { customer?: { name?: string; firstName?: string; lastName?: string } };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const money = (value: number) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function RepaymentCorrectionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [repayment, setRepayment] = useState<Repayment | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/repayments/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Unable to load repayment');
        return res.json();
      })
      .then((data) => {
        setRepayment(data);
        setAmount(String(data.amount ?? ''));
        setMethod(data.method ?? '');
        setNotes(data.notes ?? '');
      })
      .catch((err) => setError(err.message || 'Unable to load repayment'));
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const nextAmount = Number(amount);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError('Enter a repayment amount greater than zero.');
      return;
    }
    if (!repayment) return;
    if (nextAmount === Number(repayment.amount) && method === (repayment.method ?? '') && notes === (repayment.notes ?? '')) {
      setError('No correction was made. Change at least one field.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/repayments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: nextAmount, method, notes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Correction failed');
      router.push(`/repayments/view/${id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Correction failed');
    } finally {
      setSaving(false);
    }
  }

  if (error && !repayment) return <main className="correction-page"><div className="card error">{error}</div></main>;
  if (!repayment) return <main className="correction-page"><div className="card">Loading repayment correction…</div></main>;

  const customer = repayment.loan?.customer;
  const customerName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Customer';

  return (
    <main className="correction-page">
      <style jsx>{`
        .correction-page{max-width:900px;margin:0 auto;padding:10px 0 45px}.hero{padding:28px;border-radius:22px;background:linear-gradient(135deg,#073b2a,#0b5b40);color:#fff;margin-bottom:18px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;opacity:.72;margin:0 0 8px}.hero h1{margin:0 0 8px;font-size:30px}.hero p{margin:0;color:rgba(255,255,255,.78)}.card{background:#fff;border:1px solid #e4ebe7;border-radius:20px;padding:24px;box-shadow:0 8px 28px rgba(0,0,0,.04)}.error{color:#a52d2d;background:#fff5f5;border-color:#f0caca}.notice{padding:14px 16px;border-radius:12px;background:#fff8ee;border:1px solid #f4d5ad;color:#755021;font-size:13px;margin-bottom:20px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.field{display:flex;flex-direction:column;gap:7px}.field.full{grid-column:1/-1}.field label{font-size:12px;font-weight:800;color:#52625a}.field input,.field textarea{border:1px solid #dfe6e2;border-radius:11px;padding:12px;background:#fbfcfb;outline:none;font:inherit}.field input:focus,.field textarea:focus{border-color:#16845b}.readonly{background:#f3f6f4!important;color:#64716b}.summary{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}.summary-item{padding:14px;border-radius:13px;background:#f7faf8}.summary-item span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#87918c;font-weight:800}.summary-item strong{display:block;margin-top:5px;color:#173a2e}.actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.btn{border:0;border-radius:11px;padding:12px 17px;font-weight:800;text-decoration:none;cursor:pointer}.cancel{background:#eef2ef;color:#42534b}.save{background:#f7931e;color:#fff}.save:disabled{opacity:.6;cursor:not-allowed}.form-error{margin-top:14px;color:#a52d2d;font-size:13px;font-weight:700}@media(max-width:650px){.grid,.summary{grid-template-columns:1fr}.field.full{grid-column:auto}.hero{padding:22px}.card{padding:18px}}
      `}</style>

      <section className="hero">
        <p className="eyebrow">LOAN SERVICING · CONTROLLED ADJUSTMENT</p>
        <h1>Repayment Correction</h1>
        <p>Correct a recorded repayment without moving it to another loan. Financial adjustments are recorded in the ledger.</p>
      </section>

      <section className="card">
        <div className="notice"><strong>Financial integrity:</strong> the loan is locked. Changing the amount creates the appropriate repayment adjustment/reversal ledger entry instead of silently changing the financial history.</div>
        <div className="summary">
          <div className="summary-item"><span>Customer</span><strong>{customerName}</strong></div>
          <div className="summary-item"><span>Loan</span><strong>{repayment.loanId}</strong></div>
          <div className="summary-item"><span>Original Amount</span><strong>{money(Number(repayment.amount))}</strong></div>
          <div className="summary-item"><span>Current Method</span><strong>{repayment.method || '—'}</strong></div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid">
            <div className="field"><label>Loan Reference (locked)</label><input className="readonly" value={repayment.loanId} readOnly /></div>
            <div className="field"><label>Corrected Amount</label><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div className="field"><label>Payment Method</label><input value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Cash, Bank Transfer, POS…" /></div>
            <div className="field full"><label>Correction Notes</label><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Explain why this repayment is being corrected…" /></div>
          </div>
          {error && <div className="form-error">{error}</div>}
          <div className="actions"><button type="button" className="btn cancel" onClick={() => router.back()}>Cancel</button><button type="submit" className="btn save" disabled={saving}>{saving ? 'Saving correction…' : 'Save Correction'}</button></div>
        </form>
      </section>
    </main>
  );
}
