'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Repayment {
  id: string;
  loanId: string;
  amount: number;
  paymentDate: string;
  method?: string;
  status?: string;
  reference?: string;
  notes?: string;
  loan?: { id?: string; customer?: { firstName?: string; lastName?: string; name?: string } };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const money = (value: number) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function RepaymentsPage() {
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [method, setMethod] = useState('ALL');

  useEffect(() => {
    fetch(`${API_URL}/repayments`)
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setRepayments(Array.isArray(data) ? data : []))
      .catch(() => setRepayments([]))
      .finally(() => setLoading(false));
  }, []);

  const totalCollected = useMemo(() => repayments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [repayments]);
  const today = new Date().toDateString();
  const todayTotal = useMemo(() => repayments.filter((item) => new Date(item.paymentDate).toDateString() === today).reduce((sum, item) => sum + Number(item.amount || 0), 0), [repayments, today]);
  const average = repayments.length ? totalCollected / repayments.length : 0;
  const methods = Array.from(new Set(repayments.map((item) => item.method).filter(Boolean))) as string[];
  const filtered = repayments.filter((item) => {
    const text = `${item.loanId} ${item.reference || ''} ${item.method || ''} ${item.loan?.customer?.name || ''} ${item.loan?.customer?.firstName || ''} ${item.loan?.customer?.lastName || ''}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (method === 'ALL' || item.method === method);
  });

  return (
    <main className="repayment-overview">
      <style jsx>{`
        .repayment-overview{max-width:1440px;margin:0 auto;padding:8px 0 40px}.repay-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:28px 30px;border-radius:24px;background:linear-gradient(135deg,#073b2a,#0b5b40);color:#fff;box-shadow:0 18px 45px rgba(7,59,42,.16);position:relative;overflow:hidden}.repay-hero:after{content:'';position:absolute;width:230px;height:230px;border:1px solid rgba(255,255,255,.12);border-radius:50%;right:-70px;top:-100px}.eyebrow{font-size:11px;letter-spacing:.14em;font-weight:800;opacity:.72;margin:0 0 8px}.hero-title{font-size:32px;line-height:1.1;margin:0 0 9px;font-weight:850}.hero-copy{margin:0;max-width:680px;color:rgba(255,255,255,.78)}.hero-actions{display:flex;gap:10px;position:relative;z-index:1}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:12px 17px;font-weight:750;text-decoration:none}.primary{background:#f7931e;color:#fff}.secondary{border:1px solid rgba(255,255,255,.22);color:#fff;background:rgba(255,255,255,.08)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}.metric{background:#fff;border:1px solid #e7ece9;border-radius:17px;padding:19px;box-shadow:0 7px 24px rgba(0,0,0,.04)}.metric-label{display:flex;justify-content:space-between;color:#69766f;font-size:12px;font-weight:700}.metric-value{display:block;font-size:25px;margin:9px 0 4px;color:#14352a}.metric-note{font-size:11px;color:#8a958f}.orange{border-top:3px solid #f7931e}.green{border-top:3px solid #16845b}.workspace{background:#fff;border:1px solid #e7ece9;border-radius:20px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.04)}.toolbar{display:flex;justify-content:space-between;gap:15px;padding:18px 20px;border-bottom:1px solid #edf0ee;align-items:center}.toolbar h2{margin:0;font-size:18px;color:#173a2e}.toolbar p{margin:4px 0 0;color:#7b857f;font-size:12px}.filters{display:flex;gap:9px}.search,.select{border:1px solid #dfe6e2;background:#fbfcfb;border-radius:10px;padding:10px 12px;outline:none}.search{min-width:220px}.select:focus,.search:focus{border-color:#16845b}.table-wrap{overflow:auto}.table{width:100%;border-collapse:collapse;min-width:850px}.table th{background:#f8faf9;text-align:left;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#77837d;padding:12px 18px}.table td{padding:15px 18px;border-top:1px solid #f0f2f1;font-size:13px;color:#34463e}.loan-cell{display:flex;align-items:center;gap:11px}.avatar{width:34px;height:34px;border-radius:10px;background:#eaf5ef;color:#087348;display:grid;place-items:center;font-weight:800}.loan-cell strong{display:block;color:#173a2e}.loan-cell small{display:block;color:#8a958f;margin-top:2px}.amount{font-weight:800;color:#173a2e}.badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:#e9f7ef;color:#087348;font-size:10px;font-weight:800}.actions{display:flex;gap:7px}.action{border:1px solid #e0e7e3;border-radius:8px;padding:7px 10px;color:#3e5149;text-decoration:none;font-size:11px;font-weight:750;background:#fff}.empty{text-align:center;padding:65px 20px}.empty-icon{width:54px;height:54px;border-radius:16px;margin:0 auto 12px;display:grid;place-items:center;background:#fff4e8;color:#e67d0d;font-weight:900}.empty h3{margin:0 0 6px;color:#173a2e}.empty p{margin:0 0 18px;color:#87918c;font-size:13px}@media(max-width:900px){.repay-hero{align-items:flex-start;flex-direction:column}.metrics{grid-template-columns:repeat(2,1fr)}.toolbar{align-items:stretch;flex-direction:column}.filters{width:100%}.search{flex:1;min-width:0}}@media(max-width:560px){.repayment-overview{padding-top:0}.repay-hero{border-radius:16px;padding:22px}.hero-title{font-size:27px}.hero-actions{width:100%}.hero-actions a{flex:1}.metrics{grid-template-columns:1fr 1fr;gap:9px}.metric{padding:14px}.metric-value{font-size:19px}.filters{flex-direction:column}.search{width:100%}}
      `}</style>

      <section className="repay-hero">
        <div>
          <p className="eyebrow">LOAN SERVICING · COLLECTION CONTROL</p>
          <h1 className="hero-title">Repayment Overview</h1>
          <p className="hero-copy">Track collections, payment activity and repayment records from one operational workspace.</p>
        </div>
        <div className="hero-actions">
          <Link href="/loans" className="secondary">View Loans</Link>
          <Link href="/repayments/add" className="primary">+ Record Repayment</Link>
        </div>
      </section>

      <section className="metrics">
        <div className="metric green"><div className="metric-label"><span>Total Collected</span><span>₦</span></div><strong className="metric-value">{loading ? '—' : money(totalCollected)}</strong><span className="metric-note">All recorded repayments</span></div>
        <div className="metric orange"><div className="metric-label"><span>Today's Collection</span><span>●</span></div><strong className="metric-value">{loading ? '—' : money(todayTotal)}</strong><span className="metric-note">Payments received today</span></div>
        <div className="metric"><div className="metric-label"><span>Payment Records</span><span>#</span></div><strong className="metric-value">{loading ? '—' : repayments.length}</strong><span className="metric-note">Completed collection records</span></div>
        <div className="metric"><div className="metric-label"><span>Average Payment</span><span>↗</span></div><strong className="metric-value">{loading ? '—' : money(average)}</strong><span className="metric-note">Average per repayment</span></div>
      </section>

      <section className="workspace">
        <div className="toolbar">
          <div><h2>Payment Register</h2><p>{loading ? 'Loading repayment records…' : `${filtered.length} of ${repayments.length} records shown`}</p></div>
          <div className="filters"><input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search loan, customer, reference…" /><select className="select" value={method} onChange={(e) => setMethod(e.target.value)}><option value="ALL">All methods</option>{methods.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
        </div>

        {loading ? <div className="empty"><div className="empty-icon">…</div><h3>Loading payment register</h3><p>Fetching the latest repayment activity.</p></div> : filtered.length === 0 ? <div className="empty"><div className="empty-icon">₦</div><h3>No repayment records</h3><p>{query || method !== 'ALL' ? 'No records match your current filters.' : 'Start by recording the first customer repayment.'}</p><Link href="/repayments/add" className="primary">Record Repayment</Link></div> : <div className="table-wrap"><table className="table"><thead><tr><th>Loan / Customer</th><th>Amount</th><th>Payment Date</th><th>Method</th><th>Reference</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map((item) => { const customer = item.loan?.customer; const customerName = customer?.name || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ') || 'Customer'; return <tr key={item.id}><td><div className="loan-cell"><div className="avatar">₦</div><div><strong>{customerName}</strong><small>Loan {item.loanId}</small></div></div></td><td className="amount">{money(item.amount)}</td><td>{new Date(item.paymentDate).toLocaleDateString('en-NG',{day:'2-digit',month:'short',year:'numeric'})}</td><td>{item.method || '—'}</td><td>{item.reference || '—'}</td><td><span className="badge">{item.status || 'COMPLETED'}</span></td><td><div className="actions"><Link href={`/repayments/view/${item.id}`} className="action">View</Link><Link href={`/repayments/edit/${item.id}`} className="action">Edit</Link></div></td></tr>})}</tbody></table></div>}
      </section>
    </main>
  );
}
