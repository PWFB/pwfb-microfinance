'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../../lib/api';

type Row = { id: string; entryDate: string; description?: string; narration?: string; referenceNo?: string; totalAmount?: number; branch?: { name?: string }; [key: string]: any };
type Branch = { id: string; name: string };

const fields = [
  ['previousCashAtHand','Previous Cash at Hand'], ['dailyCashInHand','Daily Cash In-Hand'], ['savingsDeposits','Savings Deposits'],
  ['dailyInstallmentCollection','Daily Installment Collection'], ['monthlyCollection','Monthly Collection'], ['memberRegistration','Member Registration'],
  ['riskPremium','Risk Premium'], ['passbookSales','Passbook Sales'], ['loanDisbursement','Loan Disbursement'], ['bankDeposit','Bank Deposit'],
  ['savingsWithdrawal','Savings Withdrawal'], ['savingsReturnedAdjustment','Savings Returned/Adjustment'], ['fundTransfer','Fund Transfer'], ['other','Other'],
] as const;

const money = (v: any) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(v) || 0);

export default function StaffWalletHistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const q = new URLSearchParams();
      if (branchId) q.set('branchId', branchId);
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      const data = await apiRequest(`/cashbook/daily?${q.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load Cash Book history.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiRequest('/branches').then((data) => setBranches(Array.isArray(data) ? data : [])).catch(() => setBranches([]));
  }, []);

  useEffect(() => { load(); }, [branchId, from, to]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => [r.description, r.narration, r.referenceNo, r.branch?.name].some(v => String(v || '').toLowerCase().includes(q)));
  }, [rows, query]);

  const totals = useMemo(() => ({
    receipts: filtered.reduce((s, r) => s + fields.slice(0, 8).reduce((x, [k]) => x + (Number(r[k]) || 0), 0), 0),
    payments: filtered.reduce((s, r) => s + fields.slice(8).reduce((x, [k]) => x + (Number(r[k]) || 0), 0), 0),
  }), [filtered]);

  return <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-800">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-extrabold tracking-widest text-orange-500">PWFB STAFF WALLET</p><h1 className="text-3xl font-black text-emerald-900">Cash Book History</h1><p className="mt-1 text-sm text-slate-500">Complete history of Cash Book entries recorded through the finance operations.</p></div>
        <div className="flex gap-2"><Link href="/staff-wallet" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold">← Staff Wallet</Link><Link href="/cashbook" className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white">Open Cash Book</Link></div>
      </div>

      <section className="mb-5 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">RECORDS</p><strong className="mt-2 block text-2xl text-emerald-900">{filtered.length}</strong></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">RECEIPTS / CASH IN</p><strong className="mt-2 block text-2xl text-emerald-900">{money(totals.receipts)}</strong></div>
        <div className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-bold text-slate-500">PAYMENTS / CASH OUT</p><strong className="mt-2 block text-2xl text-orange-600">{money(totals.payments)}</strong></div>
      </section>

      <section className="mb-5 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search description, reference or branch" className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2" />
          <select value={branchId} onChange={e => setBranchId(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input type="date" value={from} onChange={e => setFrom(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" /><input type="date" value={to} onChange={e => setTo(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" /></div>
        </div>
      </section>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4"><h2 className="font-black text-emerald-900">Cash Book Entry History</h2><p className="text-xs text-slate-500">Every row links back to the same Cash Book record and remains filtered by branch/date.</p></div>
        <div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-emerald-50 text-left text-xs uppercase tracking-wide text-emerald-900"><tr><th className="p-3">Date</th><th className="p-3">Branch</th><th className="p-3">Description</th><th className="p-3">Reference</th><th className="p-3 text-right">Cash In</th><th className="p-3 text-right">Cash Out</th><th className="p-3 text-right">Total</th><th className="p-3">Action</th></tr></thead><tbody>
          {filtered.map(r => { const cashIn = fields.slice(0,8).reduce((s,[k]) => s + (Number(r[k]) || 0), 0); const cashOut = fields.slice(8).reduce((s,[k]) => s + (Number(r[k]) || 0), 0); return <tr key={r.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{new Date(r.entryDate).toLocaleDateString('en-NG')}</td><td className="p-3">{r.branch?.name || '—'}</td><td className="p-3">{r.description || r.narration || '—'}</td><td className="p-3">{r.referenceNo || '—'}</td><td className="p-3 text-right font-semibold text-emerald-700">{money(cashIn)}</td><td className="p-3 text-right font-semibold text-orange-600">{money(cashOut)}</td><td className="p-3 text-right font-bold">{money(r.totalAmount || cashIn + cashOut)}</td><td className="p-3"><Link href="/cashbook" className="font-bold text-emerald-700 hover:underline">Open Cash Book</Link></td></tr> })}
          {!loading && !filtered.length && <tr><td colSpan={8} className="p-10 text-center text-slate-500">No Cash Book history found for the selected filters.</td></tr>}
          {loading && <tr><td colSpan={8} className="p-10 text-center text-slate-500">Loading Cash Book history…</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </main>;
}
