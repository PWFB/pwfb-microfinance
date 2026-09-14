'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';

type Period = { id: string; name: string; startDate: string; endDate: string; status: string };
const date = (v: string) => new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v));

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });

  async function load() {
    setLoading(true);
    try { const data = await apiRequest('/periods'); setPeriods(Array.isArray(data) ? data : []); }
    catch (e: any) { setError(e.message || 'Unable to load financial periods.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function createPeriod(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (!form.name.trim() || !form.startDate || !form.endDate) { setError('Name, start date and end date are required.'); return; }
    if (form.endDate <= form.startDate) { setError('End date must be after start date.'); return; }
    setSaving(true);
    try { await apiRequest('/periods', { method: 'POST', body: JSON.stringify(form) }); setForm({ name: '', startDate: '', endDate: '' }); await load(); }
    catch (e: any) { setError(e.message || 'Unable to create financial period.'); }
    finally { setSaving(false); }
  }

  async function closePeriod(id: string) {
    if (!confirm('Close this financial period? New transactions should be posted to a new open period.')) return;
    try { setError(''); await apiRequest(`/periods/${id}/close`, { method: 'PATCH' }); await load(); }
    catch (e: any) { setError(e.message || 'Unable to close period.'); }
  }

  const open = periods.filter(p => p.status === 'OPEN').length;
  return <main>
    <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">FINANCE & ACCOUNTS</p><h1 className="pwfb-page-title">Financial Periods</h1><p className="pwfb-page-description">Manage accounting periods used across PWFB operations.</p></div><Link href="/dashboard" className="pwfb-secondary-button">← Dashboard</Link></div>
    {error && <div className="pwfb-alert">{error}</div>}
    <section className="pwfb-stat-grid"><div className="pwfb-stat-card"><span>Total Periods</span><strong>{loading ? '—' : periods.length}</strong><small>Registered periods</small></div><div className="pwfb-stat-card pwfb-stat-orange"><span>Open Periods</span><strong>{loading ? '—' : open}</strong><small>Currently active</small></div><div className="pwfb-stat-card"><span>Closed Periods</span><strong>{loading ? '—' : periods.length - open}</strong><small>Locked periods</small></div></section>
    <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Open New Financial Period</h2><p>Only one financial period can be open at a time.</p></div></div>
      <form onSubmit={createPeriod} className="period-form">
        <label><span>Period Name</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. September 2026" /></label>
        <label><span>Start Date</span><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
        <label><span>End Date</span><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
        <div><button type="submit" className="pwfb-primary-button" disabled={saving || open > 0}>{saving ? 'Opening…' : open > 0 ? 'Close current period first' : '+ Open Financial Period'}</button></div>
      </form>
    </section>
    <section className="pwfb-panel"><div className="pwfb-panel-header"><div><h2>Period Register</h2><p>Financial control periods for PWFB.</p></div><span className="pwfb-record-count">{periods.length} records</span></div><div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Name</th><th>Start</th><th>End</th><th>Status</th><th>Action</th></tr></thead><tbody>{periods.map(period => <tr key={period.id}><td><strong>{period.name}</strong></td><td>{date(period.startDate)}</td><td>{date(period.endDate)}</td><td><span className="pwfb-status-badge">{period.status}</span></td><td>{period.status === 'OPEN' ? <button type="button" className="pwfb-secondary-button" onClick={() => closePeriod(period.id)}>Close</button> : 'Locked'}</td></tr>)}{!loading && periods.length === 0 && <tr><td colSpan={5}>No financial periods found. Open the first period above.</td></tr>}</tbody></table></div></section>
    <style jsx>{`label{display:flex;flex-direction:column;gap:7px;font-size:13px;font-weight:700}label span{color:#475569}input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #d7dee8;border-radius:10px;background:#fff;font:inherit;font-weight:500}.period-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.pwfb-primary-button{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer;background:#f28c28;color:#fff}.pwfb-primary-button:disabled{opacity:.55;cursor:not-allowed}@media(max-width:800px){.period-form{grid-template-columns:1fr}}`}</style>
  </main>;
}
