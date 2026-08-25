'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../lib/api';

type Row = Record<string, any>;
type Data = { customers: Row[]; staff: Row[]; loans: Row[]; savings: Row[]; deposits: Row[]; withdrawals: Row[]; transfers: Row[] };
const empty: Data = { customers: [], staff: [], loans: [], savings: [], deposits: [], withdrawals: [], transfers: [] };
function money(v: any) { return `₦${Number(v || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function name(x: Row) { return [x.firstName, x.middleName, x.lastName].filter(Boolean).join(' ') || x.name || x.email || x.customer?.firstName || x.id; }
function date(x: Row) { const v = x.createdAt || x.paymentDate || x.date || x.updatedAt; return v ? new Date(v).toLocaleString('en-NG') : '—'; }

export default function AdminOverviewPage() {
  const [data, setData] = useState<Data>(empty);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<keyof Data>('customers');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/reports/operations')
      .then((result) => setData({ ...empty, ...result }))
      .catch((e) => setError(e?.message || 'Unable to load operations data.'))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => [
    ['customers', 'Customers'], ['staff', 'Staff'], ['loans', 'Loans'], ['savings', 'Savings'],
    ['deposits', 'Daily Deposits'], ['withdrawals', 'Daily Withdrawals'], ['transfers', 'Transfers'],
  ] as [keyof Data, string][], []);
  const rows = data[section];
  const total = (key: keyof Data) => data[key].reduce((s, x) => s + Number(x.amount || 0), 0);

  return <main style={{ padding: 28, maxWidth: 1500, margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 28 }}>
      <div><p style={{ color: '#18863e', fontWeight: 700, letterSpacing: 1 }}>SUPER ADMIN • OPERATIONS CONTROL</p><h1 style={{ margin: 0 }}>All Operations</h1><p style={{ color: '#667085' }}>View customers, staff, loans, savings, daily deposits, withdrawals and transfers from one place.</p></div>
      <Link href="/dashboard" style={{ padding: '11px 16px', borderRadius: 10, border: '1px solid #ddd', textDecoration: 'none' }}>← Dashboard</Link>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 25 }}>
      {sections.map(([key, label]) => <button key={key} onClick={() => setSection(key)} style={{ textAlign: 'left', padding: 18, borderRadius: 14, border: section === key ? '2px solid #18863e' : '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}><div style={{ color: '#667085', fontSize: 13 }}>{label}</div><strong style={{ fontSize: 25 }}>{loading ? '—' : data[key].length}</strong><div style={{ marginTop: 5, color: '#18863e' }}>{['loans','savings','deposits','withdrawals','transfers'].includes(key) ? money(total(key)) : 'Records'}</div></button>)}
    </div>
    <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: 20, borderBottom: '1px solid #eee' }}><h2 style={{ margin: 0 }}>{sections.find(([k]) => k === section)?.[1]}</h2><p style={{ color: '#667085' }}>Live records from the PWFB backend.</p>{error && <p style={{ color: '#b42318' }}>{error}</p>}</div>
      {loading ? <div style={{ padding: 40 }}>Loading operations…</div> : rows.length === 0 ? <div style={{ padding: 40, color: '#667085' }}>No records found.</div> : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Record','Amount','Status / Type','Date','Action'].map(h => <th key={h} style={{ textAlign: 'left', padding: 14, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{rows.map((x, i) => <tr key={x.id || i}><td style={{ padding: 14, borderTop: '1px solid #eee' }}>{name(x)}</td><td style={{ padding: 14, borderTop: '1px solid #eee' }}>{x.amount != null ? money(x.amount) : '—'}</td><td style={{ padding: 14, borderTop: '1px solid #eee' }}>{x.status || x.type || 'Recorded'}</td><td style={{ padding: 14, borderTop: '1px solid #eee' }}>{date(x)}</td><td style={{ padding: 14, borderTop: '1px solid #eee' }}>{x.id && section === 'customers' ? <Link href={`/customers/${x.id}`}>View</Link> : x.id && section === 'loans' ? <Link href={`/loans/view/${x.id}`}>View</Link> : '—'}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
