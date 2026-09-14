'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Staff = { id: string; firstName?: string; lastName?: string; employeeId?: string };
type Period = { id: string; name: string; status: string };
type Item = { id: string; staffId: string; basicSalary: number; allowances: number; deductions: number; netSalary: number; staff?: Staff };
type Payroll = { id: string; status: string; totalBasic: number; totalAllowances: number; totalDeductions: number; totalNet: number; period?: Period; branch?: { name: string }; items?: Item[] };

const money = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(v) || 0);

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selected, setSelected] = useState<Payroll | null>(null);
  const [periodId, setPeriodId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [rows, ps, ss] = await Promise.all([
        apiRequest('/payroll'),
        apiRequest('/periods'),
        apiRequest('/staff'),
      ]);
      setPayrolls(Array.isArray(rows) ? rows : []);
      setPeriods(Array.isArray(ps) ? ps : []);
      setStaff(Array.isArray(ss) ? ss : []);
      const open = (Array.isArray(ps) ? ps : []).find((p: Period) => p.status === 'OPEN');
      setPeriodId((current) => current || open?.id || '');
    } catch (e: any) { setError(e.message || 'Unable to load payroll.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createPayroll() {
    if (!periodId) return setError('Select an open financial period first.');
    setBusy(true); setError('');
    try { await apiRequest('/payroll', { method: 'POST', body: JSON.stringify({ periodId }) }); await load(); }
    catch (e: any) { setError(e.message || 'Unable to create payroll.'); }
    finally { setBusy(false); }
  }

  async function refreshSelected(id: string) {
    const fresh = await apiRequest(`/payroll/${id}`);
    setSelected(fresh);
    setPayrolls((rows) => rows.map((r) => r.id === id ? fresh : r));
  }

  async function saveItem(payrollId: string, item: Item) {
    setBusy(true); setError('');
    try {
      await apiRequest(`/payroll/${payrollId}/items`, { method: 'POST', body: JSON.stringify({ staffId: item.staffId, basicSalary: Number(item.basicSalary) || 0, allowances: Number(item.allowances) || 0, deductions: Number(item.deductions) || 0 }) });
      await refreshSelected(payrollId);
    } catch (e: any) { setError(e.message || 'Unable to save payroll item.'); }
    finally { setBusy(false); }
  }

  async function action(id: string, endpoint: string) {
    setBusy(true); setError('');
    try { await apiRequest(`/payroll/${id}/${endpoint}`, { method: 'PATCH' }); await load(); if (selected?.id === id) await refreshSelected(id); }
    catch (e: any) { setError(e.message || 'Payroll action failed.'); }
    finally { setBusy(false); }
  }

  return (
    <main>
      <div className="pwfb-page-header">
        <div><p className="pwfb-eyebrow">HUMAN RESOURCES & FINANCE</p><h1 className="pwfb-page-title">Payroll</h1><p className="pwfb-page-description">Create payroll runs, enter staff pay, approve and mark payroll as paid.</p></div>
        <Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link>
      </div>

      {error && <div className="pwfb-alert">{error}</div>}

      <section className="pwfb-panel payroll-create">
        <div><p className="pwfb-eyebrow">NEW PAYROLL RUN</p><h2>Create from an open financial period</h2><p>The system starts the run with all active staff and zero salary values ready for entry.</p></div>
        <div className="payroll-create-controls"><select value={periodId} onChange={(e) => setPeriodId(e.target.value)}><option value="">Select open period</option>{periods.filter(p => p.status === 'OPEN').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="pwfb-primary-button" disabled={busy || !periodId} onClick={createPayroll}>{busy ? 'Working…' : '+ Create Payroll Run'}</button></div>
      </section>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Payroll Runs</span><strong>{loading ? '—' : payrolls.length}</strong><small>All payroll records</small></div>
        <div className="pwfb-stat-card pwfb-stat-orange"><span>Total Net Payroll</span><strong>{loading ? '—' : money(payrolls.reduce((s,p) => s + Number(p.totalNet || 0), 0))}</strong><small>Across visible runs</small></div>
        <div className="pwfb-stat-card"><span>Draft Runs</span><strong>{loading ? '—' : payrolls.filter(p => p.status === 'DRAFT').length}</strong><small>Awaiting approval</small></div>
      </section>

      <section className="pwfb-panel">
        <div className="pwfb-panel-header"><div><h2>Payroll Register</h2><p>Draft, approved and paid payroll runs.</p></div><span className="pwfb-record-count">{payrolls.length} records</span></div>
        <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Period</th><th>Branch</th><th>Staff</th><th>Net</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {payrolls.map(p => <tr key={p.id}><td><strong>{p.period?.name || '—'}</strong></td><td>{p.branch?.name || 'All branches'}</td><td>{p.items?.length || 0}</td><td>{money(p.totalNet)}</td><td><span className="pwfb-status-badge">{p.status}</span></td><td><button className="pwfb-secondary-button" onClick={() => setSelected(p)}>Open</button>{p.status === 'DRAFT' && <button className="pwfb-secondary-button" disabled={busy} onClick={() => action(p.id,'approve')}>Approve</button>}{p.status === 'APPROVED' && <button className="pwfb-secondary-button" disabled={busy} onClick={() => action(p.id,'pay')}>Mark Paid</button>}</td></tr>)}
          {!loading && payrolls.length === 0 && <tr><td colSpan={6}>No payroll records found. Create the first run from an open financial period.</td></tr>}
        </tbody></table></div>
      </section>

      {selected && <section className="pwfb-panel payroll-editor"><div className="pwfb-panel-header"><div><p className="pwfb-eyebrow">PAYROLL DETAILS</p><h2>{selected.period?.name || 'Payroll run'}</h2><p>{selected.status} • {selected.items?.length || 0} staff records</p></div><button className="pwfb-secondary-button" onClick={() => setSelected(null)}>Close</button></div>
        {selected.status !== 'DRAFT' && <div className="pwfb-alert">This payroll is {selected.status.toLowerCase()} and can no longer be edited.</div>}
        <div className="payroll-items">{(selected.items || []).map(item => <PayrollItemEditor key={item.id} item={item} disabled={selected.status !== 'DRAFT' || busy} onSave={() => saveItem(selected.id, item)} />)}</div>
        <div className="payroll-total">Total net: <strong>{money(selected.totalNet)}</strong></div>
      </section>}

      <style jsx>{`
        .payroll-create{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:18px;background:linear-gradient(135deg,#f7fcf8,#fff)}
        .payroll-create h2{margin:4px 0;font-size:19px}.payroll-create p:not(.pwfb-eyebrow){margin:0;color:#718078;font-size:12px}.payroll-create-controls{display:flex;gap:10px;align-items:center}.payroll-create select{min-width:220px;padding:11px 12px;border:1px solid var(--pwfb-border);border-radius:10px;background:#fff}.pwfb-primary-button{border:0;border-radius:10px;padding:11px 15px;background:var(--pwfb-green);color:#fff;font-weight:800;cursor:pointer}.pwfb-primary-button:disabled{opacity:.55;cursor:not-allowed}.payroll-editor{margin-top:18px}.payroll-items{display:grid;gap:10px}.payroll-item{display:grid;grid-template-columns:1.5fr repeat(3,1fr) auto;gap:10px;align-items:end;padding:13px;border:1px solid var(--pwfb-border);border-radius:12px;background:#fff}.payroll-item label{display:block;color:#718078;font-size:10px;font-weight:700;margin-bottom:4px}.payroll-item input{width:100%;box-sizing:border-box;padding:9px;border:1px solid var(--pwfb-border);border-radius:8px}.payroll-staff{padding-bottom:8px}.payroll-staff strong{display:block;font-size:12px}.payroll-staff small{color:#7a867f;font-size:10px}.payroll-total{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--pwfb-border)}
        @media(max-width:800px){.payroll-create{display:block}.payroll-create-controls{margin-top:14px;flex-direction:column;align-items:stretch}.payroll-create select{min-width:0}.payroll-item{grid-template-columns:1fr 1fr}.payroll-staff{grid-column:1/-1}.payroll-item button{grid-column:1/-1}}
      `}</style>
    </main>
  );
}

function PayrollItemEditor({ item, disabled, onSave }: { item: Item; disabled: boolean; onSave: () => void }) {
  const [value, setValue] = useState(item);
  const name = `${value.staff?.firstName || 'Staff'} ${value.staff?.lastName || ''}`.trim();
  return <div className="payroll-item"><div className="payroll-staff"><strong>{name}</strong><small>{value.staff?.employeeId || value.staffId}</small></div><label>Basic<input type="number" min="0" value={value.basicSalary} disabled={disabled} onChange={e => setValue({...value,basicSalary:Number(e.target.value)})}/></label><label>Allowances<input type="number" min="0" value={value.allowances} disabled={disabled} onChange={e => setValue({...value,allowances:Number(e.target.value)})}/></label><label>Deductions<input type="number" min="0" value={value.deductions} disabled={disabled} onChange={e => setValue({...value,deductions:Number(e.target.value)})}/></label><button className="pwfb-secondary-button" disabled={disabled} onClick={onSave}>Save</button></div>;
}
