'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Loan { id: string; amount?: number; status?: string; customer?: { firstName?: string; lastName?: string; name?: string } }

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const money = (value: number) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function AddRepaymentPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/loans`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setLoans(Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []))
      .catch(() => setLoans([]))
      .finally(() => setLoadingLoans(false));
  }, []);

  const selectedLoan = loans.find((loan) => loan.id === loanId);
  const customerName = selectedLoan?.customer?.name || [selectedLoan?.customer?.firstName, selectedLoan?.customer?.lastName].filter(Boolean).join(' ') || 'Customer not selected';
  const enteredAmount = Number(amount || 0);
  const progress = selectedLoan?.amount ? Math.min(100, Math.round((enteredAmount / Number(selectedLoan.amount)) * 100)) : 0;

  const canSubmit = Boolean(loanId && enteredAmount > 0 && method && paymentDate && !saving);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!loanId || enteredAmount <= 0) { setError('Select a loan and enter a repayment amount greater than zero.'); return; }
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/repayments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loanId, amount: enteredAmount, method, paymentDate, reference: reference || undefined, notes: notes || undefined }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.message || 'Unable to save repayment.'); }
      router.push('/repayments');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save repayment.'); setSaving(false); }
  }

  return (
    <main className="add-repayment">
      <style jsx>{`
        .add-repayment{max-width:1180px;margin:0 auto;padding:6px 0 45px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.back{color:#64736b;text-decoration:none;font-size:13px;font-weight:700}.heading h1{margin:5px 0 7px;font-size:30px;color:#173a2e}.heading p{margin:0;color:#78847e;font-size:13px}.eyebrow{margin:0;color:#f0800c;font-size:10px;letter-spacing:.15em;font-weight:850}.layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,.8fr);gap:18px}.card{background:#fff;border:1px solid #e5ebe8;border-radius:20px;box-shadow:0 8px 28px rgba(0,0,0,.04);padding:24px}.section-title{display:flex;align-items:center;gap:10px;margin-bottom:19px}.number{width:30px;height:30px;border-radius:9px;background:#e9f6ef;color:#087348;display:grid;place-items:center;font-size:11px;font-weight:900}.section-title h2{font-size:16px;margin:0;color:#173a2e}.field{margin-bottom:16px}.field label{display:block;font-size:11px;font-weight:800;color:#52625a;margin-bottom:7px}.input,.select,.textarea{width:100%;box-sizing:border-box;border:1px solid #dce5e0;border-radius:11px;background:#fbfcfb;padding:12px 13px;font:inherit;font-size:13px;color:#253b32;outline:none}.input:focus,.select:focus,.textarea:focus{border-color:#16845b;box-shadow:0 0 0 3px rgba(22,132,91,.08)}.textarea{min-height:95px;resize:vertical}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.loan-preview{border:1px solid #dcebe3;background:#f6fbf8;border-radius:14px;padding:15px;margin-bottom:18px}.preview-top{display:flex;justify-content:space-between;gap:12px}.preview-top strong{display:block;color:#173a2e;font-size:14px}.preview-top small{color:#87928c}.status{background:#e4f5eb;color:#087348;border-radius:999px;padding:5px 9px;font-size:9px;font-weight:900;height:max-content}.preview-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.preview-row span{display:block;font-size:10px;color:#7b8881}.preview-row strong{display:block;color:#173a2e;margin-top:3px}.side{background:linear-gradient(160deg,#073b2a,#0b5b40);color:#fff}.side h2,.side h3{color:#fff}.side-copy{color:rgba(255,255,255,.7);font-size:12px;line-height:1.6}.amount-preview{padding:18px;border-radius:15px;background:rgba(255,255,255,.08);margin:20px 0}.amount-preview span{font-size:10px;color:rgba(255,255,255,.62);text-transform:uppercase;letter-spacing:.1em}.amount-preview strong{display:block;font-size:28px;margin-top:5px}.progress{height:7px;border-radius:99px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:12px}.progress i{display:block;height:100%;background:#f7931e;border-radius:99px}.side-list{display:grid;gap:11px;margin-top:20px}.side-item{display:flex;gap:10px;font-size:11px;color:rgba(255,255,255,.76)}.side-item b{color:#f7931e}.actions{display:flex;justify-content:flex-end;gap:10px;padding-top:5px}.cancel,.save{border-radius:11px;padding:12px 18px;text-decoration:none;font-weight:800;font-size:12px}.cancel{border:1px solid #dce5e0;color:#52625a}.save{border:0;background:#f7931e;color:#fff;cursor:pointer}.save:disabled{opacity:.5;cursor:not-allowed}.error{padding:11px 13px;border-radius:10px;background:#fff0f0;border:1px solid #ffd4d4;color:#b42318;font-size:12px;margin-bottom:15px}.hint{font-size:10px;color:#8a958f;margin-top:6px}@media(max-width:850px){.layout{grid-template-columns:1fr}.side{order:-1}.top{align-items:flex-start;gap:10px}.grid2{grid-template-columns:1fr}}@media(max-width:520px){.add-repayment{padding-top:0}.card{padding:18px;border-radius:16px}.heading h1{font-size:25px}.actions{position:sticky;bottom:8px;background:#fff;padding:12px;border:1px solid #e5ebe8;border-radius:13px}.actions>*{flex:1;text-align:center}}
      `}</style>

      <div className="top"><div className="heading"><p className="eyebrow">LOAN SERVICING · COLLECTION ENTRY</p><h1>Record Repayment</h1><p>Create a verified repayment record and keep the loan balance history accurate.</p></div><Link href="/repayments" className="back">← Back to Repayments</Link></div>

      <form onSubmit={handleSubmit} className="layout">
        <div>
          <section className="card">
            <div className="section-title"><span className="number">01</span><h2>Loan & borrower</h2></div>
            <div className="field"><label>SELECT LOAN *</label><select className="select" value={loanId} onChange={(e) => setLoanId(e.target.value)} disabled={loadingLoans}><option value="">{loadingLoans ? 'Loading loans…' : 'Choose the customer loan'}</option>{loans.map((loan) => { const name = loan.customer?.name || [loan.customer?.firstName, loan.customer?.lastName].filter(Boolean).join(' ') || 'Customer'; return <option key={loan.id} value={loan.id}>{name} · Loan {loan.id.slice(0, 12)}</option>; })}</select><p className="hint">Only select the loan receiving this payment.</p></div>
            {selectedLoan && <div className="loan-preview"><div className="preview-top"><div><strong>{customerName}</strong><small>Loan {selectedLoan.id}</small></div><span className="status">{selectedLoan.status || 'ACTIVE'}</span></div><div className="preview-row"><div><span>Loan Amount</span><strong>{money(Number(selectedLoan.amount || 0))}</strong></div><div><span>Selected Payment</span><strong>{money(enteredAmount)}</strong></div></div></div>}

            <div className="section-title"><span className="number">02</span><h2>Payment details</h2></div>
            <div className="grid2"><div className="field"><label>PAYMENT AMOUNT *</label><input className="input" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required /></div><div className="field"><label>PAYMENT METHOD *</label><select className="select" value={method} onChange={(e) => setMethod(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Card</option><option>Mobile Money</option><option>Other</option></select></div></div>
            <div className="grid2"><div className="field"><label>PAYMENT DATE *</label><input className="input" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required /></div><div className="field"><label>REFERENCE</label><input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Receipt / transfer reference" /></div></div>

            <div className="section-title"><span className="number">03</span><h2>Collection notes</h2></div>
            <div className="field"><label>NOTES</label><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a short operational note if required…" /></div>
            {error && <div className="error">{error}</div>}
            <div className="actions"><Link href="/repayments" className="cancel">Cancel</Link><button type="submit" className="save" disabled={!canSubmit}>{saving ? 'Saving…' : 'Save Repayment'}</button></div>
          </section>
        </div>

        <aside className="card side"><div className="section-title"><span className="number">₦</span><h2>Payment preview</h2></div><p className="side-copy">Review the collection before saving. The backend will validate the amount against the selected loan.</p><div className="amount-preview"><span>Repayment amount</span><strong>{money(enteredAmount)}</strong>{selectedLoan?.amount ? <div className="progress"><i style={{width:`${progress}%`}} /></div> : null}</div><h3>Entry checklist</h3><div className="side-list"><div className="side-item"><b>✓</b><span>Correct customer loan selected</span></div><div className="side-item"><b>✓</b><span>Amount is greater than zero</span></div><div className="side-item"><b>✓</b><span>Payment method recorded</span></div><div className="side-item"><b>✓</b><span>Reference can support reconciliation</span></div></div></aside>
      </form>
    </main>
  );
}
