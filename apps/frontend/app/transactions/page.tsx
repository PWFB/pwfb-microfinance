'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { pwfbApi } from '../../lib/pwfb-api';

interface Transaction {
  id: string;
  customerId: string;
  customer?: { firstName?: string; lastName?: string };
  type: string;
  amount: number;
  description?: string;
  status?: string;
  source?: string;
  provider?: string;
  providerReference?: string;
  reference?: string;
  processedAt?: string;
  createdAt: string;
  walletBalanceBefore?: number | null;
  walletBalanceAfter?: number | null;
}

const money = (value: number) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');

  useEffect(() => {
    pwfbApi.transactions.list()
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => transactions.filter((t) => {
    const q = search.trim().toLowerCase();
    const name = `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.trim();
    const matchesSearch = !q || [name, t.customerId, t.type, t.description, t.reference, t.providerReference].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || t.type.toUpperCase() === typeFilter;
    const matchesSource = sourceFilter === 'ALL' || (t.source ?? 'LEDGER') === sourceFilter;
    return matchesSearch && matchesType && matchesSource;
  }), [transactions, search, typeFilter, sourceFilter]);

  const totalValue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const walletCount = transactions.filter((t) => t.source === 'WALLET').length;
  const ledgerCount = transactions.filter((t) => t.source !== 'WALLET').length;

  return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCIAL OPERATIONS</p>
          <h1 className="pwfb-page-title">Transaction Overview</h1>
          <p className="pwfb-page-description">Monitor, search and audit every customer financial transaction from one control center.</p>
        </div>
        <Link href="/transactions/add" className="pwfb-primary-button">+ Add Transaction</Link>
      </div>

      <section className="pwfb-banking-hero">
        <div className="pwfb-banking-step">
          <div className="pwfb-step-number">01</div>
          <div>
            <label>TRANSACTION CONTROL CENTER</label>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 24 }}>Financial activity at a glance</h2>
            <p style={{ margin: '6px 0 0', color: '#c9ead3', fontSize: 11 }}>Ledger and system-generated wallet transactions are consolidated here for operational visibility.</p>
          </div>
        </div>
        <div className="pwfb-banking-hero-note">
          <b>✓ Audit-ready ledger</b>
          <span>System-generated wallet records remain protected from manual editing.</span>
        </div>
      </section>

      <section className="pwfb-stat-grid">
        <div className="pwfb-stat-card"><span>Total Transactions</span><strong>{loading ? '—' : transactions.length}</strong><small>All recorded activity</small></div>
        <div className="pwfb-stat-card"><span>Total Transaction Value</span><strong>{loading ? '—' : money(totalValue)}</strong><small>Combined transaction value</small></div>
        <div className="pwfb-stat-card"><span>Wallet Activity</span><strong>{loading ? '—' : walletCount}</strong><small>System-generated records</small></div>
        <div className="pwfb-stat-card"><span>Ledger Entries</span><strong>{loading ? '—' : ledgerCount}</strong><small>Manual financial records</small></div>
      </section>

      <section className="pwfb-panel" style={{ marginTop: 18 }}>
        <div className="pwfb-panel-header">
          <div><h2>Transaction Ledger</h2><p>Search by customer, ID, transaction type or reference.</p></div>
          <span className="pwfb-record-count">{loading ? 'Loading...' : `${filtered.length} records`}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1fr) 180px 160px', gap: 10, padding: 18, borderBottom: '1px solid #edf1ee' }}>
          <input className="pwfb-input" placeholder="Search customer, ID or reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="pwfb-input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">All transaction types</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TRANSFER">Transfer</option><option value="LOAN DISBURSEMENT">Loan Disbursement</option><option value="LOAN REPAYMENT">Loan Repayment</option>
          </select>
          <select className="pwfb-input" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="ALL">All sources</option><option value="LEDGER">Ledger</option><option value="WALLET">Wallet</option>
          </select>
        </div>

        {loading ? <div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading transactions...</p></div> : filtered.length === 0 ? (
          <div className="pwfb-empty-state"><div className="pwfb-empty-icon">₦</div><h3>No transactions found</h3><p>Try another search or record the first financial transaction.</p><Link href="/transactions/add" className="pwfb-secondary-button">Add Transaction</Link></div>
        ) : (
          <div className="pwfb-table-wrap"><table className="pwfb-table"><thead><tr><th>Customer</th><th>Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date & Time</th><th>Source</th><th>Actions</th></tr></thead><tbody>
            {filtered.map((t) => {
              const name = `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.trim() || 'Customer';
              const date = new Date(t.processedAt || t.createdAt);
              return <tr key={t.id}>
                <td><div className="pwfb-customer-cell"><div className="pwfb-avatar">₦</div><div><strong>{name}</strong><small>{t.customerId}</small></div></div></td>
                <td><span className="pwfb-type-badge">{t.type}</span></td>
                <td><strong>{money(t.amount)}</strong></td>
                <td><span className="pwfb-status-badge">{t.status || 'COMPLETED'}</span></td>
                <td><div>{t.provider || 'PWFB'}</div><small>{t.providerReference || t.reference || t.id}</small></td>
                <td>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG')}</td>
                <td><span className="pwfb-type-badge">{t.source || 'LEDGER'}</span></td>
                <td><div className="pwfb-actions"><Link href={`/transactions/view/${t.id}`} className="pwfb-action-view">View</Link>{t.source !== 'WALLET' && <Link href={`/transactions/edit/${t.id}`} className="pwfb-action-edit">Edit</Link>}</div></td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
