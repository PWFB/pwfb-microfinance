'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../lib/api';

type Row = Record<string, any>;
type Data = { customers: Row[]; staff: Row[]; loans: Row[]; savings: Row[]; deposits: Row[]; withdrawals: Row[]; transfers: Row[] };
const empty: Data = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [] };
const labels: Record<keyof Data, string> = { customers: 'Customers', staff: 'Staff', loans: 'Loans', savings: 'Savings', deposits: 'Daily Deposits', withdrawals: 'Daily Withdrawals', transfers: 'Transfers' };
function money(v: any) { return `₦${Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function name(x: Row) { return [x.firstName, x.middleName, x.lastName].filter(Boolean).join(' ') || x.name || x.email || x.customer?.firstName || x.id; }
function date(x: Row) { const v = x.createdAt || x.paymentDate || x.date || x.updatedAt; return v ? new Date(v).toLocaleString('en-NG') : '—'; }
function csvEscape(v: any) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }

export default function AdminOverviewPage() {
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<keyof Data>('customers');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50, total: 0, totalPages: 1 });
  const [error, setError] = useState('');

  async function load(nextPage = page) {
    setLoading(true); setError('');
    try {
      const qs = new URLSearchParams({ section, search, type, from, to, page: String(nextPage), pageSize: String(pageSize) });
      const result = await apiRequest(`/reports/operations?${qs.toString()}`);
      setData({ ...empty, ...result });
      setPagination(result.pagination || { page: nextPage, pageSize, total: 0, totalPages: 1 });
    } catch (e: any) { setError(e?.message || 'Unable to load operations data.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(1); }, [section, type, from, to, pageSize]);
  useEffect(() => { const t = setTimeout(() => load(1), 350); return () => clearTimeout(t); }, [search]);

  const rows = data[section];
  const totalAmount = rows.reduce((s, x) => s + Number(x.amount || 0), 0);
  const sections = useMemo(() => Object.keys(labels) as (keyof Data)[], []);

  function resetFilters() { setSearch(''); setType(''); setFrom(''); setTo(''); setPage(1); }
  function exportCsv() {
    const headers = ['Section', 'Name/Record', 'Amount', 'Status/Type', 'Reference', 'Date'];
    const body = rows.map(x => [labels[section], name(x), x.amount ?? '', x.status || x.type || '', x.reference || x.id || '', date(x)]);
    const csv = [headers, ...body].map(r => r.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pwfb-${section}-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return <main style={{ padding: 28, maxWidth: 1500, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 24 }}>
      <div><p style={{ color: '#18863e', fontWeight: 700, letterSpacing: 1 }}>SUPER ADMIN • OPERATIONS CONTROL</p><h1 style={{ margin: 0 }}>All Operations</h1><p style={{ color: '#667085' }}>Search, filter, inspect and export PWFB operational records.</p></div>
      <Link href="/dashboard" style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid #ddd', textDecoration: 'none' }}>← Dashboard</Link>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 18 }}>
      {sections.map(key => <button key={key} onClick={() => { setSection(key); setPage(1); }} style={{ textAlign: 'left', padding: 14, borderRadius: 12, border: section === key ? '2px solid #18863e' : '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><div style={{ color: '#667085', fontSize: 12 }}>{labels[key]}</div><strong style={{ fontSize: 22 }}>{loading ? '—' : pagination.total}</strong></button>)}
    </div>

    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 18, marginBottom: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) repeat(4,minmax(130px,1fr)) auto auto', gap: 10, alignItems: 'end' }}>
        <label>Search<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Name, phone, email, ID, reference…" style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #d0d5dd', borderRadius: 9 }} /></label>
        <label>Type<select value={type} onChange={e => { setType(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #d0d5dd', borderRadius: 9 }}><option value="">All</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TRANSFER_IN">Transfer In</option><option value="TRANSFER_OUT">Transfer Out</option></select></label>
        <label>From<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #d0d5dd', borderRadius: 9 }} /></label>
        <label>To<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #d0d5dd', borderRadius: 9 }} /></label>
        <label>Rows<select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ width: '100%', padding: 10, marginTop: 5, border: '1px solid #d0d5dd', borderRadius: 9 }}><option value="25">25</option><option value="50">50</option><option value="100">100</option><option value="200">200</option></select></label>
        <button onClick={resetFilters} style={{ padding: 10, border: '1px solid #d0d5dd', borderRadius: 9, background: '#fff' }}>Reset</button>
        <button onClick={exportCsv} disabled={loading || rows.length === 0} style={{ padding: 10, border: 0, borderRadius: 9, background: '#18863e', color: '#fff' }}>Export CSV</button>
      </div>
    </section>

    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: 18, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', gap: 15 }}><div><h2 style={{ margin: 0 }}>{labels[section]}</h2><p style={{ color: '#667085', marginBottom: 0 }}>{pagination.total.toLocaleString()} matching records • {money(totalAmount)} on this page</p></div>{error && <p style={{ color: '#b42318' }}>{error}</p>}</div>
      {loading ? <div style={{ padding: 40 }}>Loading operations…</div> : rows.length === 0 ? <div style={{ padding: 40, color: '#667085' }}>No records match the current filters.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Record','Amount','Status / Type','Reference','Date','Action'].map(h => <th key={h} style={{ textAlign: 'left', padding: 13, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{rows.map((x, i) => <tr key={x.id || i}><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{name(x)}</td><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{x.amount != null ? money(x.amount) : '—'}</td><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{x.status || x.type || 'Recorded'}</td><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{x.reference || x.id || '—'}</td><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{date(x)}</td><td style={{ padding: 13, borderTop: '1px solid #eee' }}>{x.id && section === 'customers' ? <Link href={`/customers/${x.id}`}>View</Link> : x.id && section === 'loans' ? <Link href={`/loans/view/${x.id}`}>View</Link> : '—'}</td></tr>)}</tbody></table></div>}
      <div style={{ padding: 14, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>Page {pagination.page} of {pagination.totalPages}</span><div style={{ display: 'flex', gap: 8 }}><button disabled={page <= 1 || loading} onClick={() => { const p = page - 1; setPage(p); load(p); }} style={{ padding: '8px 13px' }}>Previous</button><button disabled={page >= pagination.totalPages || loading} onClick={() => { const p = page + 1; setPage(p); load(p); }} style={{ padding: '8px 13px' }}>Next</button></div></div>
    </section>
  </main>;
}
