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

const money = (value: number) =>
  `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const customerName = (t: Transaction) =>
  `${t.customer?.firstName ?? ''} ${t.customer?.lastName ?? ''}`.trim() || 'Customer';

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerId = params.get('customerId') || '';
    setCustomerFilter(customerId);
    const request = customerId ? pwfbApi.customers.history(customerId) : pwfbApi.transactions.list();
    request
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('Transaction history load failed:', error);
        setLoadError('We could not load transaction records. Please check your connection and try again.');
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => transactions.filter((t) => {
    if (customerFilter && t.customerId !== customerFilter) return false;
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [
      customerName(t), t.id, t.customerId, t.type, t.description,
      t.reference, t.providerReference, t.provider, t.status, t.source,
    ].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchesType = typeFilter === 'ALL' || t.type.toUpperCase() === typeFilter;
    const matchesSource = sourceFilter === 'ALL' || (t.source ?? 'LEDGER').toUpperCase() === sourceFilter;
    const matchesStatus = statusFilter === 'ALL' || (t.status ?? 'COMPLETED').toUpperCase() === statusFilter;
    const date = new Date(t.processedAt || t.createdAt);
    const day = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    const matchesFrom = !dateFrom || (!!day && day >= dateFrom);
    const matchesTo = !dateTo || (!!day && day <= dateTo);
    return matchesSearch && matchesType && matchesSource && matchesStatus && matchesFrom && matchesTo;
  }), [transactions, search, typeFilter, sourceFilter, statusFilter, dateFrom, dateTo, customerFilter]);

  const totalValue = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const walletCount = transactions.filter((t) => (t.source ?? '').toUpperCase() === 'WALLET').length;
  const ledgerCount = transactions.filter((t) => (t.source ?? 'LEDGER').toUpperCase() !== 'WALLET').length;
  const filtersActive = Boolean(search || typeFilter !== 'ALL' || sourceFilter !== 'ALL' || statusFilter !== 'ALL' || dateFrom || dateTo);

  function clearFilters() {
    setSearch('');
    setTypeFilter('ALL');
    setSourceFilter('ALL');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  }

  function showAllTransactions() {
    setCustomerFilter('');
    clearFilters();
    window.history.replaceState({}, '', '/transactions');
    setLoading(true);
    setLoadError('');
    pwfbApi.transactions.list()
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch((error) => {
        console.error('Transaction list reload failed:', error);
        setLoadError('We could not load transaction records. Please try again.');
        setTransactions([]);
      })
      .finally(() => setLoading(false));
  }

  return (
    <main className="pwfb-banking-page pwfb-transaction-overview">
      <style jsx>{`
        .pwfb-transaction-overview { --tx-green:#087443; --tx-ink:#16392b; --tx-muted:#718078; }
        .tx-shell { max-width: 1500px; margin: 0 auto; }
        .tx-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:22px; }
        .tx-eyebrow { margin:0 0 7px; color:var(--tx-green); font-size:10px; font-weight:900; letter-spacing:.16em; }
        .tx-title { margin:0; color:var(--tx-ink); font-size:clamp(25px,3vw,34px); line-height:1.15; letter-spacing:-.035em; }
        .tx-description { margin:9px 0 0; max-width:680px; color:var(--tx-muted); font-size:13px; line-height:1.65; }
        .tx-header-actions { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .tx-button { display:inline-flex; justify-content:center; align-items:center; gap:8px; border-radius:11px; padding:12px 16px; font-size:12px; font-weight:850; text-decoration:none; cursor:pointer; white-space:nowrap; }
        .tx-primary { border:1px solid #087443; background:#087443; color:#fff; box-shadow:0 5px 12px #0874431c; }
        .tx-secondary { border:1px solid #dce7e0; background:#fff; color:#375448; }
        .tx-hero { display:flex; justify-content:space-between; align-items:center; gap:24px; padding:25px 27px; border-radius:20px; background:linear-gradient(120deg,#064d2d 0%,#087443 58%,#15945b 100%); color:#fff; box-shadow:0 14px 30px #075b2a18; }
        .tx-hero-main { display:flex; align-items:flex-start; gap:15px; min-width:0; }
        .tx-step { flex:0 0 42px; height:42px; display:grid; place-items:center; border:1px solid #ffffff42; border-radius:13px; background:#ffffff16; font-size:13px; font-weight:900; }
        .tx-hero-label { color:#c6f2d8; font-size:9px; font-weight:900; letter-spacing:.16em; }
        .tx-hero h2 { margin:6px 0 0; font-size:clamp(19px,2.2vw,25px); line-height:1.2; }
        .tx-hero p { max-width:600px; margin:8px 0 0; color:#d8f1e2; font-size:12px; line-height:1.6; }
        .tx-audit-note { flex:0 0 230px; padding:13px 15px; border:1px solid #ffffff30; border-radius:13px; background:#ffffff12; }
        .tx-audit-note strong { display:block; font-size:12px; }
        .tx-audit-note span { display:block; margin-top:5px; color:#d8f1e2; font-size:10px; line-height:1.5; }
        .tx-stats { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:13px; margin-top:16px; }
        .tx-stat { min-width:0; padding:18px; border:1px solid #e4ece7; border-radius:16px; background:#fff; box-shadow:0 6px 20px #103b2510; }
        .tx-stat-top { display:flex; justify-content:space-between; align-items:center; gap:10px; }
        .tx-stat-icon { width:36px; height:36px; display:grid; place-items:center; border-radius:11px; background:#eaf6ef; color:#087443; font-size:17px; font-weight:900; }
        .tx-stat-index { color:#a0aca5; font-size:10px; font-weight:800; }
        .tx-stat-label { display:block; margin-top:14px; color:#65766d; font-size:11px; font-weight:750; }
        .tx-stat-value { display:block; margin-top:6px; color:#173c2d; font-size:clamp(22px,2.5vw,29px); font-weight:900; letter-spacing:-.035em; overflow-wrap:anywhere; }
        .tx-stat-help { display:block; margin-top:5px; color:#8b9790; font-size:10px; }
        .tx-panel { margin-top:18px; overflow:hidden; border:1px solid #e2eae5; border-radius:18px; background:#fff; box-shadow:0 8px 24px #103b250c; }
        .tx-panel-head { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:21px 22px 17px; }
        .tx-panel-head h2 { margin:0; color:#193d2e; font-size:17px; }
        .tx-panel-head p { margin:5px 0 0; color:#7b8981; font-size:11px; }
        .tx-count { display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border-radius:9px; background:#eff8f2; color:#087443; font-size:10px; font-weight:850; white-space:nowrap; }
        .tx-filters { display:grid; grid-template-columns:minmax(220px,1.7fr) repeat(3,minmax(135px,1fr)); gap:10px; padding:16px 22px; border-top:1px solid #edf2ee; border-bottom:1px solid #edf2ee; background:#f9fbfa; }
        .tx-filter { width:100%; min-width:0; box-sizing:border-box; border:1px solid #dce6df; border-radius:10px; background:#fff; color:#263e32; padding:11px 12px; font:inherit; font-size:12px; outline-offset:2px; }
        .tx-filter:focus { border-color:#12834e; outline:2px solid #12834e20; }
        .tx-date-row { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
        .tx-date-label { color:#68786f; font-size:10px; font-weight:800; }
        .tx-filter-actions { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:12px 22px; }
        .tx-filter-hint { color:#7b8981; font-size:10px; }
        .tx-clear { padding:8px 11px; border:1px solid #dce6df; border-radius:9px; background:#fff; color:#355647; font-size:11px; font-weight:800; cursor:pointer; }
        .tx-clear:disabled { opacity:.45; cursor:not-allowed; }
        .tx-table-scroll { width:100%; overflow-x:auto; }
        .tx-table { width:100%; border-collapse:collapse; text-align:left; font-size:11px; }
        .tx-table th { padding:12px 14px; background:#f8faf9; border-top:1px solid #edf2ee; border-bottom:1px solid #e7eee9; color:#77857d; font-size:9px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; white-space:nowrap; }
        .tx-table td { padding:14px; border-bottom:1px solid #eef2ef; color:#354b40; vertical-align:middle; }
        .tx-table tbody tr:hover { background:#fbfdfb; }
        .tx-customer { display:flex; align-items:center; gap:10px; min-width:155px; }
        .tx-avatar { flex:0 0 34px; width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:#e9f5ee; color:#087443; font-size:13px; font-weight:900; }
        .tx-customer-name { display:block; color:#1b4934; font-size:11px; font-weight:850; text-decoration:none; }
        .tx-sub { display:block; margin-top:4px; color:#8b9790; font-size:9px; overflow-wrap:anywhere; }
        .tx-pill { display:inline-flex; padding:5px 8px; border-radius:7px; background:#f0f5f2; color:#4b6356; font-size:9px; font-weight:850; white-space:nowrap; }
        .tx-status { background:#eaf7ef; color:#087443; }
        .tx-amount { color:#193d2e; font-weight:900; white-space:nowrap; }
        .tx-row-actions { display:flex; align-items:center; gap:8px; white-space:nowrap; }
        .tx-row-actions a { color:#087443; font-size:10px; font-weight:850; text-decoration:none; }
        .tx-row-actions a:hover { text-decoration:underline; }
        .tx-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:44px 20px; }
        .tx-empty-icon { width:54px; height:54px; display:grid; place-items:center; border-radius:17px; background:#eef7f1; color:#087443; font-size:25px; }
        .tx-empty h3 { margin:15px 0 0; color:#1b4934; font-size:16px; }
        .tx-empty p { max-width:430px; margin:7px 0 17px; color:#7b8981; font-size:12px; line-height:1.6; }
        .tx-alert { margin:16px 22px; padding:12px 14px; border:1px solid #f2d3ce; border-radius:10px; background:#fff6f4; color:#a3392c; font-size:12px; }
        .tx-loading { padding:36px 20px; text-align:center; color:#7b8981; font-size:12px; }
        @media(max-width:950px) { .tx-stats { grid-template-columns:repeat(2,minmax(0,1fr)); } .tx-filters { grid-template-columns:repeat(2,minmax(0,1fr)); } .tx-search { grid-column:1/-1; } .tx-hero { align-items:flex-start; flex-direction:column; } .tx-audit-note { flex-basis:auto; width:auto; } }
        @media(max-width:620px) { .tx-header { flex-direction:column; } .tx-header-actions { width:100%; } .tx-header-actions .tx-button { flex:1; } .tx-hero { padding:19px; border-radius:15px; } .tx-hero-main { gap:11px; } .tx-step { flex-basis:35px; height:35px; } .tx-stats { gap:9px; } .tx-stat { padding:13px; border-radius:13px; } .tx-stat-icon { width:30px; height:30px; } .tx-stat-label { margin-top:10px; font-size:10px; } .tx-stat-value { font-size:21px; } .tx-panel-head { align-items:flex-start; padding:17px 15px 14px; } .tx-filters { grid-template-columns:1fr; padding:13px 15px; } .tx-search { grid-column:auto; } .tx-filter-actions { padding:11px 15px; } .tx-date-row { width:100%; } .tx-date-row .tx-filter { flex:1; } .tx-table th,.tx-table td { padding:12px 10px; } }
      `}</style>

      <div className="tx-shell">
        <header className="tx-header">
          <div>
            <p className="tx-eyebrow">FINANCIAL OPERATIONS / CONTROL CENTER</p>
            <h1 className="tx-title">{customerFilter ? 'Client Transaction History' : 'Transaction Overview'}</h1>
            <p className="tx-description">{customerFilter ? `Review the financial activity associated with customer ${customerFilter}.` : 'Monitor, search, reconcile and audit customer financial activity from one secure control center.'}</p>
          </div>
          <div className="tx-header-actions">
            {customerFilter && <button type="button" onClick={showAllTransactions} className="tx-button tx-secondary">← All transactions</button>}
            <Link href="/transactions/add" className="tx-button tx-primary">＋ Add Transaction</Link>
          </div>
        </header>

        <section className="tx-hero">
          <div className="tx-hero-main">
            <div className="tx-step">01</div>
            <div>
              <span className="tx-hero-label">TRANSACTION CONTROL CENTER</span>
              <h2>Financial activity at a glance</h2>
              <p>Ledger entries and system-generated wallet records are brought together for operational visibility and audit review.</p>
            </div>
          </div>
          <div className="tx-audit-note">
            <strong>✓ &nbsp; Audit-ready ledger</strong>
            <span>System-generated wallet records are protected from manual editing. Corrections should preserve an auditable trail.</span>
          </div>
        </section>

        <section className="tx-stats" aria-label="Transaction summary">
          <article className="tx-stat"><div className="tx-stat-top"><span className="tx-stat-icon">↔</span><span className="tx-stat-index">01 / ACTIVITY</span></div><span className="tx-stat-label">Total Transactions</span><strong className="tx-stat-value">{loading ? '—' : transactions.length.toLocaleString('en-NG')}</strong><small className="tx-stat-help">All records loaded</small></article>
          <article className="tx-stat"><div className="tx-stat-top"><span className="tx-stat-icon">₦</span><span className="tx-stat-index">02 / VALUE</span></div><span className="tx-stat-label">Total Transaction Value</span><strong className="tx-stat-value">{loading ? '—' : money(totalValue)}</strong><small className="tx-stat-help">Combined recorded amounts</small></article>
          <article className="tx-stat"><div className="tx-stat-top"><span className="tx-stat-icon">◉</span><span className="tx-stat-index">03 / WALLET</span></div><span className="tx-stat-label">Wallet Activity</span><strong className="tx-stat-value">{loading ? '—' : walletCount.toLocaleString('en-NG')}</strong><small className="tx-stat-help">System-generated records</small></article>
          <article className="tx-stat"><div className="tx-stat-top"><span className="tx-stat-icon">▤</span><span className="tx-stat-index">04 / LEDGER</span></div><span className="tx-stat-label">Ledger Entries</span><strong className="tx-stat-value">{loading ? '—' : ledgerCount.toLocaleString('en-NG')}</strong><small className="tx-stat-help">Non-wallet ledger records</small></article>
        </section>

        <section className="tx-panel" aria-labelledby="tx-ledger-title">
          <div className="tx-panel-head">
            <div><h2 id="tx-ledger-title">Transaction Ledger</h2><p>Search by customer, transaction ID, type, provider or reference.</p></div>
            <span className="tx-count">{loading ? 'Loading records' : `${filtered.length} matching records`}</span>
          </div>

          <div className="tx-filters">
            <input className="tx-filter tx-search" aria-label="Search transactions" placeholder="⌕  Search customer, ID, type or reference…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="tx-filter" aria-label="Filter transaction type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="ALL">All transaction types</option><option value="DEPOSIT">Deposit</option><option value="WITHDRAWAL">Withdrawal</option><option value="TRANSFER">Transfer</option><option value="LOAN DISBURSEMENT">Loan Disbursement</option><option value="LOAN REPAYMENT">Loan Repayment</option></select>
            <select className="tx-filter" aria-label="Filter transaction source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="ALL">All sources</option><option value="LEDGER">Ledger</option><option value="WALLET">Wallet</option></select>
            <select className="tx-filter" aria-label="Filter transaction status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All statuses</option><option value="COMPLETED">Completed</option><option value="SUCCESS">Success</option><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option><option value="FAILED">Failed</option><option value="REVERSED">Reversed</option><option value="CANCELLED">Cancelled</option></select>
          </div>

          <div className="tx-filter-actions">
            <span className="tx-filter-hint">{filtersActive ? 'Filters are active. Clear them to see all records.' : 'Showing records matching the selected customer scope.'}</span>
            <button type="button" className="tx-clear" onClick={clearFilters} disabled={!filtersActive}>↺ &nbsp; Clear filters</button>
          </div>

          {loadError && <div className="tx-alert" role="alert">{loadError}</div>}
          {loading ? <div className="tx-loading" role="status">Loading financial records…</div> :
            filtered.length === 0 ? <div className="tx-empty">
              <div className="tx-empty-icon">{loadError ? '!' : filtersActive ? '⌕' : '₦'}</div>
              <h3>{loadError ? 'Transactions unavailable' : filtersActive ? 'No matching transactions' : 'No transactions recorded yet'}</h3>
              <p>{loadError ? 'The ledger could not be retrieved. Your records have not been changed; retry after checking the connection.' : filtersActive ? 'No records match these filters. Clear the filters to return to the full transaction list.' : 'When financial activity is recorded, it will appear here with its source, status, reference and audit details.'}</p>
              {filtersActive && <button type="button" onClick={clearFilters} className="tx-button tx-secondary">Clear all filters</button>}
              {!filtersActive && !loadError && <Link href="/transactions/add" className="tx-button tx-primary">＋ Add Transaction</Link>}
            </div> :
            <div className="tx-table-scroll"><table className="tx-table"><thead><tr><th>Customer</th><th>Transaction Type</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date &amp; Time</th><th>Source</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((t) => {
                const date = new Date(t.processedAt || t.createdAt);
                const status = (t.status || 'COMPLETED').toUpperCase();
                return <tr key={t.id}>
                  <td><div className="tx-customer"><div className="tx-avatar">₦</div><div><Link className="tx-customer-name" href={`/customers/view/${encodeURIComponent(t.customerId)}`}>{customerName(t)}</Link><small className="tx-sub">{t.customerId || 'Customer ID unavailable'}</small></div></div></td>
                  <td><span className="tx-pill">{t.type || 'Transaction'}</span></td>
                  <td><strong className="tx-amount">{money(Number(t.amount || 0))}</strong></td>
                  <td><span className={`tx-pill ${['COMPLETED','SUCCESS','SUCCEEDED'].includes(status) ? 'tx-status' : ''}`}>{status}</span></td>
                  <td><span>{t.provider || 'PWFB'}</span><small className="tx-sub">{t.providerReference || t.reference || t.id}</small></td>
                  <td>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td><span className="tx-pill">{(t.source || 'LEDGER').toUpperCase()}</span></td>
                  <td><div className="tx-row-actions"><Link href={`/transactions/view/${encodeURIComponent(t.id)}`}>View</Link>{(t.source || 'LEDGER').toUpperCase() !== 'WALLET' && <Link href={`/transactions/edit/${encodeURIComponent(t.id)}`}>Correction</Link>}</div></td>
                </tr>;
              })}</tbody></table></div>}
        </section>
      </div>
    </main>
  );
}
