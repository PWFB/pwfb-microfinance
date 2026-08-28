'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Branch = { id: string; name: string };
type Period = { id: string; name: string; status?: string };
type Row = {
  id: string;
  entryDate: string;
  branch?: { name: string };
  dailyLoanNo: number; dailyLoanAmount: number;
  weeklyLoanNo: number; weeklyLoanAmount: number;
  monthlyLoanNo: number; monthlyLoanAmount: number;
  bankDeposit: number; savingWithdrawal: number; savingReturned: number; savingAdjustment: number;
  fundTransferHeadOffice: number; fundTransferBranchOffice: number;
  otherAmount: number; expenseAmount: number; totalAmount: number;
  description?: string; narration?: string; referenceNo?: string;
};

const money = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(v) || 0);
const num = (v: string) => Number(v || 0);

const amountFields = [
  ['dailyLoanAmount', 'Daily Loan'], ['weeklyLoanAmount', 'Weekly Loan'], ['monthlyLoanAmount', 'Monthly Loan'],
  ['bankDeposit', 'Bank Deposit'], ['savingWithdrawal', 'Saving Withdrawal'], ['savingReturned', 'Saving Returned'],
  ['savingAdjustment', 'Saving Adjustment'], ['fundTransferHeadOffice', 'Fund Transfer — Head Office'],
  ['fundTransferBranchOffice', 'Fund Transfer — Branch Office'], ['otherAmount', 'Other'], ['expenseAmount', 'Expenses'],
] as const;

const emptyForm = {
  entryDate: new Date().toISOString().slice(0, 10), description: '',
  dailyLoanNo: '0', dailyLoanAmount: '0', weeklyLoanNo: '0', weeklyLoanAmount: '0', monthlyLoanNo: '0', monthlyLoanAmount: '0',
  bankDeposit: '0', savingWithdrawal: '0', savingReturned: '0', savingAdjustment: '0',
  fundTransferHeadOffice: '0', fundTransferBranchOffice: '0', otherAmount: '0', expenseAmount: '0',
  narration: '', referenceNo: '',
};

export default function CashbookPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [branchId, setBranchId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const formTotal = useMemo(() => amountFields.reduce((sum, [key]) => sum + num(form[key]), 0), [form]);
  const totals = useMemo(() => rows.reduce((s, r) => {
    for (const [key] of amountFields) s[key] = (s[key] || 0) + Number(r[key] || 0);
    s.dailyLoanNo += Number(r.dailyLoanNo || 0); s.weeklyLoanNo += Number(r.weeklyLoanNo || 0); s.monthlyLoanNo += Number(r.monthlyLoanNo || 0);
    s.totalAmount += Number(r.totalAmount || 0); return s;
  }, { dailyLoanNo: 0, weeklyLoanNo: 0, monthlyLoanNo: 0, totalAmount: 0 } as Record<string, number>), [rows]);

  async function loadBase() {
    try {
      const [b, p] = await Promise.all([apiRequest('/branches'), apiRequest('/periods')]);
      const branchRows = Array.isArray(b) ? b : [];
      const periodRows = Array.isArray(p) ? p : [];
      setBranches(branchRows); setPeriods(periodRows);
      if (!branchId && branchRows[0]) setBranchId(branchRows[0].id);
      if (!periodId) {
        const current = periodRows.find((x: Period) => x.status === 'OPEN') || periodRows[0];
        if (current) setPeriodId(current.id);
      }
    } catch (e: any) { setError(e.message || 'Unable to load branches and financial periods.'); }
  }

  async function loadRows() {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (periodId) query.set('periodId', periodId); if (branchId) query.set('branchId', branchId);
      const data = await apiRequest(`/cashbook/daily?${query.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message || 'Unable to load daily cashbook.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { if (periodId || branchId) loadRows(); }, [periodId, branchId]);

  function setField(key: keyof typeof emptyForm, value: string) { setForm(prev => ({ ...prev, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const payload: any = { periodId, branchId, entryDate: form.entryDate, description: form.description, narration: form.narration, referenceNo: form.referenceNo };
      for (const [key] of amountFields) payload[key] = num(form[key]);
      payload.dailyLoanNo = num(form.dailyLoanNo); payload.weeklyLoanNo = num(form.weeklyLoanNo); payload.monthlyLoanNo = num(form.monthlyLoanNo);
      if (editingId) await apiRequest(`/cashbook/daily/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiRequest('/cashbook/daily', { method: 'POST', body: JSON.stringify(payload) });
      setMessage(editingId ? 'Daily cashbook record updated.' : 'Daily cashbook record saved.'); setEditingId(null); setForm(emptyForm); await loadRows();
    } catch (e: any) { setError(e.message || 'Unable to save cashbook record.'); }
    finally { setSaving(false); }
  }

  function edit(row: Row) {
    setEditingId(row.id);
    const next: any = { ...emptyForm, entryDate: new Date(row.entryDate).toISOString().slice(0, 10), description: row.description || '', narration: row.narration || '', referenceNo: row.referenceNo || '' };
    for (const [key] of amountFields) next[key] = String(row[key] || 0);
    next.dailyLoanNo = String(row.dailyLoanNo || 0); next.weeklyLoanNo = String(row.weeklyLoanNo || 0); next.monthlyLoanNo = String(row.monthlyLoanNo || 0);
    setForm(next); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(id: string) {
    if (!confirm('Delete this daily cashbook record?')) return;
    try { await apiRequest(`/cashbook/daily/${id}`, { method: 'DELETE' }); setMessage('Daily cashbook record deleted.'); await loadRows(); }
    catch (e: any) { setError(e.message || 'Unable to delete record.'); }
  }

  function downloadCsv() {
    const headers = ['Date','Branch','Daily Loan No','Daily Loan','Weekly Loan No','Weekly Loan','Monthly Loan No','Monthly Loan','Bank Deposit','Saving Withdrawal','Saving Returned','Saving Adjustment','Fund Transfer Head Office','Fund Transfer Branch Office','Other','Expenses','Total','Narration','Reference No'];
    const lines = rows.map(r => [new Date(r.entryDate).toLocaleDateString('en-NG'), r.branch?.name || '', r.dailyLoanNo, r.dailyLoanAmount, r.weeklyLoanNo, r.weeklyLoanAmount, r.monthlyLoanNo, r.monthlyLoanAmount, r.bankDeposit, r.savingWithdrawal, r.savingReturned, r.savingAdjustment, r.fundTransferHeadOffice, r.fundTransferBranchOffice, r.otherAmount, r.expenseAmount, r.totalAmount, r.narration || '', r.referenceNo || ''].map(x => `"${String(x).replaceAll('"','""')}"`).join(','));
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `PWFB-Cashbook-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div><p className="pwfb-eyebrow">FINANCE & ACCOUNTS</p><h1 className="pwfb-page-title">Daily Cashbook</h1><p className="pwfb-page-description">Daily branch cashbook for loan disbursements, deposits, savings movements, transfers, expenses and other financial history.</p></div>
        <div className="flex gap-2"><button onClick={downloadCsv} className="pwfb-secondary-button">Download CSV</button><Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link></div>
      </div>

      {error && <div className="pwfb-alert mb-4">{error}</div>}{message && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}

      <section className="pwfb-panel mb-5">
        <div className="pwfb-panel-header"><div><h2>{editingId ? 'Edit Daily Cashbook' : 'Remit Daily Cashbook'}</h2><p>Record the same financial movements shown on the PWFB paper cashbook.</p></div></div>
        <form onSubmit={submit} className="space-y-5 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label>Date<input type="date" value={form.entryDate} onChange={e => setField('entryDate', e.target.value)} required /></label>
            <label>Financial Period<select value={periodId} onChange={e => setPeriodId(e.target.value)} required><option value="">Select period</option>{periods.map(p => <option key={p.id} value={p.id}>{p.name}{p.status === 'CLOSED' ? ' — CLOSED' : ''}</option>)}</select></label>
            <label>Branch<select value={branchId} onChange={e => setBranchId(e.target.value)} required><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {([['dailyLoanNo','Daily Loan No'],['dailyLoanAmount','Daily Loan Amount'],['weeklyLoanNo','Weekly Loan No'],['weeklyLoanAmount','Weekly Loan Amount'],['monthlyLoanNo','Monthly Loan No'],['monthlyLoanAmount','Monthly Loan Amount']] as const).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" step={key.endsWith('No') ? '1' : '0.01'} value={form[key]} onChange={e => setField(key,e.target.value)} /></label>)}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {amountFields.slice(3).map(([key,label]) => <label key={key}>{label}<input type="number" min="0" step="0.01" value={form[key]} onChange={e => setField(key,e.target.value)} /></label>)}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label>Description<input value={form.description} onChange={e => setField('description',e.target.value)} placeholder="Daily branch activity" /></label>
            <label>Narration<textarea value={form.narration} onChange={e => setField('narration',e.target.value)} placeholder="Explain the transaction or expense" /></label>
            <label>Reference No.<input value={form.referenceNo} onChange={e => setField('referenceNo',e.target.value)} placeholder="Reference / receipt number" /></label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div><span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Current Entry Total</span><div className="text-2xl font-black text-emerald-900">{money(formTotal)}</div></div><div className="flex gap-2"><button type="submit" disabled={saving || !periodId || !branchId} className="pwfb-primary-button">{saving ? 'Saving…' : editingId ? 'Update Record' : 'Save Daily Record'}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} className="pwfb-secondary-button">Cancel</button>}</div></div>
        </form>
      </section>

      <section className="pwfb-stat-grid mb-5">
        <div className="pwfb-stat-card"><span>Daily Loan</span><strong>{money(totals.dailyLoanAmount)}</strong><small>{totals.dailyLoanNo} loans</small></div>
        <div className="pwfb-stat-card"><span>Weekly Loan</span><strong>{money(totals.weeklyLoanAmount)}</strong><small>{totals.weeklyLoanNo} loans</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Monthly Loan</span><strong>{money(totals.monthlyLoanAmount)}</strong><small>{totals.monthlyLoanNo} loans</small></div>
        <div className="pwfb-stat-card"><span>Expenses</span><strong>{money(totals.expenseAmount)}</strong><small>Recorded expenses</small></div>
        <div className="pwfb-stat-card"><span>Total History</span><strong>{money(totals.totalAmount)}</strong><small>{rows.length} daily records</small></div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header"><div><h2>Daily Cashbook History</h2><p>Every saved record is totaled automatically. Edit or remove records while the financial period remains open.</p></div><span className="pwfb-record-count">{rows.length} records</span></div>
        <div className="pwfb-table-wrap"><table className="pwfb-table min-w-[1800px]"><thead><tr><th>Date</th><th>Branch</th><th>Daily Loan</th><th>Weekly Loan</th><th>Monthly Loan</th><th>Bank Deposit</th><th>Saving Withdrawal</th><th>Saving Returned</th><th>Adjustment</th><th>HO Transfer</th><th>Branch Transfer</th><th>Other</th><th>Expenses</th><th>Total</th><th>Action</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{new Date(r.entryDate).toLocaleDateString('en-NG')}</td><td>{r.branch?.name || '—'}</td><td>{money(r.dailyLoanAmount)}</td><td>{money(r.weeklyLoanAmount)}</td><td>{money(r.monthlyLoanAmount)}</td><td>{money(r.bankDeposit)}</td><td>{money(r.savingWithdrawal)}</td><td>{money(r.savingReturned)}</td><td>{money(r.savingAdjustment)}</td><td>{money(r.fundTransferHeadOffice)}</td><td>{money(r.fundTransferBranchOffice)}</td><td>{money(r.otherAmount)}</td><td>{money(r.expenseAmount)}</td><td><strong>{money(r.totalAmount)}</strong></td><td><div className="flex gap-2"><button onClick={() => edit(r)} className="pwfb-secondary-button">Edit</button><button onClick={() => remove(r.id)} className="pwfb-secondary-button">Delete</button></div></td></tr>)}{!loading && rows.length === 0 && <tr><td colSpan={15}>No daily cashbook records found for the selected branch and period.</td></tr>}{loading && <tr><td colSpan={15}>Loading daily cashbook…</td></tr>}</tbody><tfoot><tr><th colSpan={2}>TOTAL</th><th>{money(totals.dailyLoanAmount)}</th><th>{money(totals.weeklyLoanAmount)}</th><th>{money(totals.monthlyLoanAmount)}</th><th>{money(totals.bankDeposit)}</th><th>{money(totals.savingWithdrawal)}</th><th>{money(totals.savingReturned)}</th><th>{money(totals.savingAdjustment)}</th><th>{money(totals.fundTransferHeadOffice)}</th><th>{money(totals.fundTransferBranchOffice)}</th><th>{money(totals.otherAmount)}</th><th>{money(totals.expenseAmount)}</th><th>{money(totals.totalAmount)}</th><th>—</th></tr></tfoot></table></div>
      </section>
    </main>
  );
}
