'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Staff = { id: string; staffId?: string; firstName?: string; middleName?: string; lastName?: string; position?: string; employmentStatus?: string; branchId?: string; branch?: { id?: string; name?: string }; region?: { id?: string; name?: string }; division?: { id?: string; name?: string }; area?: { id?: string; name?: string } };
type Branch = { id: string; name: string };
type Period = { id: string; name: string; status?: string };
type Customer = { id: string; firstName?: string; lastName?: string; phone?: string; branchId?: string };
type Wallet = { id: string; staffId: string; branchId: string; balance: number; currency?: string; firstName?: string; lastName?: string; position?: string; branchName?: string };

const money = (v: unknown) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(v) || 0);
const today = () => new Date().toISOString().slice(0, 10);

export default function StaffDailyWalletPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [staffId, setStaffId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [collectionType, setCollectionType] = useState<'SAVINGS' | 'LOAN_REPAYMENT' | 'OTHER'>('SAVINGS');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [issueAmount, setIssueAmount] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [s, w, b, p, c] = await Promise.all([
        apiRequest('/staff'), apiRequest('/staff-wallet'), apiRequest('/branches'), apiRequest('/periods'), apiRequest('/customers'),
      ]);
      const ss = Array.isArray(s) ? s : Array.isArray(s?.data) ? s.data : [];
      const ww = Array.isArray(w) ? w : [];
      const bb = Array.isArray(b) ? b : [];
      const pp = Array.isArray(p) ? p : [];
      const cc = Array.isArray(c) ? c : Array.isArray(c?.data) ? c.data : [];
      setStaff(ss); setWallets(ww); setBranches(bb); setPeriods(pp); setCustomers(cc);
      if (!branchId && bb[0]) setBranchId(bb[0].id);
      if (!periodId) { const open = pp.find((x: Period) => x.status === 'OPEN') || pp[0]; if (open) setPeriodId(open.id); }
      if (!staffId) { const active = ss.find((x: Staff) => x.employmentStatus === 'ACTIVE') || ss[0]; if (active) { setStaffId(active.id); if (!branchId && active.branchId) setBranchId(active.branchId); } }
    } catch (e: any) { setError(e?.message || 'Unable to load staff daily wallet.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const selectedStaff = useMemo(() => staff.find(s => s.id === staffId), [staff, staffId]);
  const selectedWallet = useMemo(() => wallets.find(w => w.staffId === staffId), [wallets, staffId]);
  const staffForBranch = useMemo(() => staff.filter(s => s.employmentStatus !== 'INACTIVE' && (!branchId || !s.branchId || s.branchId === branchId)), [staff, branchId]);
  const branchCustomers = useMemo(() => customers.filter(c => !branchId || !c.branchId || c.branchId === branchId), [customers, branchId]);

  function chooseStaff(id: string) {
    setStaffId(id);
    const s = staff.find(x => x.id === id);
    if (s?.branchId) setBranchId(s.branchId);
  }

  async function issueCash(e: React.FormEvent) {
    e.preventDefault(); setSaving('issue'); setError(''); setMessage('');
    try {
      if (!staffId || Number(issueAmount) <= 0) throw new Error('Select staff and enter the cash issued.');
      await apiRequest('/staff-wallet/issue', { method: 'POST', body: JSON.stringify({ staffId, amount: Number(issueAmount), reference: reference || undefined, description: 'Daily field cash issued' }) });
      setIssueAmount(''); setMessage('Field cash issued to the staff wallet.'); await load();
    } catch (e: any) { setError(e?.message || 'Unable to issue field cash.'); }
    finally { setSaving(''); }
  }

  async function postCollection(e: React.FormEvent) {
    e.preventDefault(); setSaving('collection'); setError(''); setMessage('');
    try {
      if (!periodId || !branchId || !staffId || !customerId || Number(collectionAmount) <= 0) throw new Error('Period, branch, collector, customer and amount are required.');
      await apiRequest('/collections', { method: 'POST', body: JSON.stringify({ periodId, branchId, staffId, customerId, type: collectionType, amount: Number(collectionAmount), reference: reference || undefined, notes: notes || undefined, collectionDate: today() }) });
      setCollectionAmount(''); setReference(''); setNotes(''); setMessage('Daily collection recorded. It is now ready for reconciliation and financial settlement.');
    } catch (e: any) { setError(e?.message || 'Unable to record daily collection.'); }
    finally { setSaving(''); }
  }

  async function settleCash(e: React.FormEvent) {
    e.preventDefault(); setSaving('settle'); setError(''); setMessage('');
    try {
      if (!staffId || Number(settleAmount) <= 0) throw new Error('Select staff and enter the amount being returned/settled.');
      await apiRequest('/staff-wallet/settle', { method: 'POST', body: JSON.stringify({ staffId, amount: Number(settleAmount), reference: reference || undefined, description: 'Daily field cash settlement' }) });
      setSettleAmount(''); setReference(''); setMessage('Staff cash settlement posted and wallet balance updated.'); await load();
    } catch (e: any) { setError(e?.message || 'Unable to settle staff cash.'); }
    finally { setSaving(''); }
  }

  const displayName = selectedStaff ? [selectedStaff.firstName, selectedStaff.middleName, selectedStaff.lastName].filter(Boolean).join(' ') : 'Select a field staff';
  const location = [selectedStaff?.region?.name, selectedStaff?.division?.name, selectedStaff?.area?.name, selectedStaff?.branch?.name || branches.find(b => b.id === selectedStaff?.branchId)?.name].filter(Boolean).join(' · ');

  return <main className="min-h-screen bg-slate-50 p-4 text-slate-800 md:p-7"><div className="mx-auto max-w-7xl">
    <header className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-700 to-orange-500 p-6 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black tracking-[.2em] text-orange-200">PWFB FIELD OPERATIONS</p><h1 className="text-3xl font-black">Staff Daily Wallet</h1><p className="mt-1 max-w-2xl text-sm text-emerald-50">The daily workspace for staff who go into the field: receive cash, register customers, collect money and settle the day.</p></div><div className="flex flex-wrap gap-2"><Link href="/customers/add" className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-black">+ Register Client</Link><Link href="/collections" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold">Daily Collections</Link><Link href="/staff-wallet" className="rounded-xl bg-white/15 px-4 py-2 text-sm font-bold">Wallet Control</Link></div></div></header>

    {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>}{message && <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</div>}

    <section className="mb-5 grid gap-4 md:grid-cols-4"><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">Selected staff</p><strong className="mt-1 block text-lg text-emerald-900">{displayName}</strong><p className="mt-1 text-xs text-slate-500">{selectedStaff?.staffId || selectedStaff?.id || '—'}</p></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">Wallet balance</p><strong className="mt-1 block text-2xl text-emerald-700">{money(selectedWallet?.balance)}</strong></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">Position</p><strong className="mt-1 block text-lg">{selectedStaff?.position || selectedWallet?.position || '—'}</strong></div><div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black text-slate-500">Region · Division · Area · Branch</p><strong className="mt-1 block text-sm">{location || selectedWallet?.branchName || '—'}</strong></div></section>

    <section className="mb-6 rounded-3xl bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-4"><label className="grid gap-1 text-xs font-bold">Field staff<select className="rounded-xl border p-3 text-sm" value={staffId} onChange={e => chooseStaff(e.target.value)}><option value="">Select staff</option>{staffForBranch.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} — {s.position || 'Staff'}{s.staffId ? ` · ${s.staffId}` : ''}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Branch<select className="rounded-xl border p-3 text-sm" value={branchId} onChange={e => { setBranchId(e.target.value); setStaffId(''); }}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="grid gap-1 text-xs font-bold">Financial period<select className="rounded-xl border p-3 text-sm" value={periodId} onChange={e => setPeriodId(e.target.value)}><option value="">Select period</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name} {p.status === 'CLOSED' ? '— CLOSED' : ''}</option>)}</select></label><div className="flex items-end"><Link href="/staff-wallet/history" className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-800">View Wallet History</Link></div></div></section>

    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-black tracking-widest text-orange-600">START OF DAY</p><h2 className="mt-1 text-xl font-black text-emerald-900">Issue field cash</h2><p className="mt-1 text-xs text-slate-500">Cash entrusted to the field staff becomes their accountable wallet balance.</p><form onSubmit={issueCash} className="mt-4 grid gap-3"><input className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Amount" value={issueAmount} onChange={e => setIssueAmount(e.target.value)} required/><input className="rounded-xl border p-3" placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)}/><button disabled={saving==='issue'} className="rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white">{saving==='issue' ? 'Posting…' : 'Issue Cash'}</button></form></section>

      <section className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-black tracking-widest text-emerald-600">DAILY COLLECTION</p><h2 className="mt-1 text-xl font-black text-emerald-900">Collect from a client</h2><p className="mt-1 text-xs text-slate-500">Use this every day for savings, loan repayment or another approved collection.</p><form onSubmit={postCollection} className="mt-4 grid gap-3"><select className="rounded-xl border p-3" value={customerId} onChange={e => setCustomerId(e.target.value)} required><option value="">Select client</option>{branchCustomers.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.phone ? ` · ${c.phone}` : ''}</option>)}</select><select className="rounded-xl border p-3" value={collectionType} onChange={e => setCollectionType(e.target.value as any)}><option value="SAVINGS">Savings</option><option value="LOAN_REPAYMENT">Loan repayment</option><option value="OTHER">Other</option></select><input className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Amount" value={collectionAmount} onChange={e => setCollectionAmount(e.target.value)} required/><input className="rounded-xl border p-3" placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)}/><button disabled={saving==='collection'} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-black text-white">{saving==='collection' ? 'Recording…' : 'Record Daily Collection'}</button></form><Link href="/collections" className="mt-3 block text-center text-xs font-bold text-emerald-700">Open full collection register →</Link></section>

      <section className="rounded-3xl bg-white p-5 shadow-sm"><p className="text-xs font-black tracking-widest text-slate-500">END OF DAY</p><h2 className="mt-1 text-xl font-black text-emerald-900">Settle staff cash</h2><p className="mt-1 text-xs text-slate-500">Return/settle accountable cash after field work. The wallet cannot settle more than its balance.</p><form onSubmit={settleCash} className="mt-4 grid gap-3"><input className="rounded-xl border p-3" type="number" min="0" step="0.01" placeholder="Settlement amount" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} required/><input className="rounded-xl border p-3" placeholder="Reference" value={reference} onChange={e => setReference(e.target.value)}/><button disabled={saving==='settle'} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white">{saving==='settle' ? 'Settling…' : 'Settle Cash'}</button></form></section>
    </div>

    <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black tracking-widest text-emerald-700">STAFF DIRECTORY</p><h2 className="text-xl font-black text-emerald-900">Field staff available for daily work</h2><p className="text-xs text-slate-500">Only useful operational information is shown here. The supplied sample staff list is not imported as application data.</p></div><Link href="/staff" className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">Open Staff Management</Link></div><div className="mt-4 overflow-x-auto"><table className="min-w-[850px] w-full text-sm"><thead className="bg-emerald-50 text-left text-xs uppercase text-emerald-900"><tr><th className="p-3">Staff ID</th><th className="p-3">Name</th><th className="p-3">Position</th><th className="p-3">Region</th><th className="p-3">Division</th><th className="p-3">Area</th><th className="p-3">Branch</th><th className="p-3">Action</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="p-5">Loading live staff…</td></tr> : staff.filter(s => s.employmentStatus !== 'INACTIVE').slice(0, 100).map(s => <tr key={s.id} className="border-t"><td className="p-3 font-bold">{s.staffId || s.id}</td><td className="p-3">{[s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ') || '—'}</td><td className="p-3">{s.position || '—'}</td><td className="p-3">{s.region?.name || '—'}</td><td className="p-3">{s.division?.name || '—'}</td><td className="p-3">{s.area?.name || '—'}</td><td className="p-3">{s.branch?.name || branches.find(b => b.id === s.branchId)?.name || '—'}</td><td className="p-3"><button type="button" onClick={() => chooseStaff(s.id)} className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-black text-orange-700">Use for today</button></td></tr>)}{!loading && staff.length === 0 && <tr><td colSpan={8} className="p-5">No live staff records found.</td></tr>}</tbody></table></div></section>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Link href="/customers" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-emerald-200"><b>Customer Management</b><span className="mt-1 block text-xs text-slate-500">Find or register clients</span></Link><Link href="/savings" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-emerald-200"><b>Savings</b><span className="mt-1 block text-xs text-slate-500">Savings accounts and balances</span></Link><Link href="/loans" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-emerald-200"><b>Loans</b><span className="mt-1 block text-xs text-slate-500">Loan portfolio and disbursement</span></Link><Link href="/cashbook" className="rounded-2xl bg-white p-4 shadow-sm hover:ring-2 hover:ring-emerald-200"><b>Cash Book</b><span className="mt-1 block text-xs text-slate-500">Daily receipts, payments and closing cash</span></Link></section>
  </div></main>;
}
