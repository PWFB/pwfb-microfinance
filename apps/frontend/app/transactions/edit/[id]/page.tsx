'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { pwfbApi } from '../../../../lib/pwfb-api';

interface Transaction {
  id: string;
  customerId?: string;
  customer?: { id?: string; firstName?: string; lastName?: string } | null;
  type?: string;
  amount?: number | string;
  description?: string | null;
  status?: string;
  source?: string;
  providerReference?: string | null;
  reference?: string | null;
  createdAt?: string;
}

const money = (value: number | string | null | undefined) =>
  `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateTime = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function EditTransactionPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    pwfbApi.transactions.get(id)
      .then((data) => {
        if (!active) return;
        const record = data?.data && !data?.id ? data.data : data;
        setTransaction(record ?? null);
        if (!record) setError('Transaction details could not be found.');
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load transaction.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <main className="pwfb-banking-page"><div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading transaction correction record...</p></div></main>;

  if (!transaction) return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header"><div><p className="pwfb-eyebrow">FINANCIAL CONTROLS / CORRECTION</p><h1 className="pwfb-page-title">Transaction Correction</h1></div><Link href="/transactions" className="pwfb-secondary-button">← Transactions</Link></div>
      <section className="pwfb-panel"><div className="pwfb-empty-state"><div className="pwfb-empty-icon">!</div><h3>Transaction unavailable</h3><p>{error || 'No transaction record was returned by the PWFB API.'}</p></div></section>
    </main>
  );

  const customerName = `${transaction.customer?.firstName ?? ''} ${transaction.customer?.lastName ?? ''}`.trim() || 'Customer';
  const reference = transaction.providerReference || transaction.reference || transaction.id;
  const operation = String(transaction.type || 'TRANSACTION').replaceAll('_', ' ');

  return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header">
        <div>
          <p className="pwfb-eyebrow">FINANCIAL CONTROLS / CORRECTION</p>
          <h1 className="pwfb-page-title">Transaction Correction</h1>
          <p className="pwfb-page-description">Financial ledger entries are immutable. Review the original record and create a correcting entry instead of overwriting history.</p>
        </div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link href={`/transactions/view/${transaction.id}`} className="pwfb-secondary-button">View Receipt</Link>
          <Link href="/transactions" className="pwfb-secondary-button">← Transactions</Link>
        </div>
      </div>

      <section className="pwfb-banking-hero">
        <div className="pwfb-banking-step">
          <div className="pwfb-step-number">✓</div>
          <div><label>ORIGINAL LEDGER ENTRY</label><h2 style={{ margin: 0, color: '#fff', fontSize: 24 }}>{money(transaction.amount)}</h2><p style={{ margin: '6px 0 0', color: '#c9ead3', fontSize: 11 }}>{operation} • {customerName}</p></div>
        </div>
        <div className="pwfb-banking-hero-note"><b>🔒 IMMUTABLE</b><span>Corrections must preserve the original audit trail</span></div>
      </section>

      <section className="pwfb-panel" style={{ marginTop: 18 }}>
        <div className="pwfb-panel-header">
          <div><h2>Original Transaction</h2><p>This record remains unchanged for audit and reconciliation.</p></div>
          <span className="pwfb-operation-badge">{transaction.source || 'LEDGER'}</span>
        </div>
        <div className="pwfb-banking-form-grid" style={{ padding: 18 }}>
          <div className="pwfb-verify-field verified"><span>Customer</span><strong>{customerName}</strong><small>{transaction.customerId || transaction.customer?.id || '—'}</small></div>
          <div className="pwfb-verify-field"><span>Transaction Type</span><strong>{operation}</strong></div>
          <div className="pwfb-verify-field verified"><span>Amount</span><strong>{money(transaction.amount)}</strong></div>
          <div className="pwfb-verify-field"><span>Status</span><strong>{transaction.status || 'COMPLETED'}</strong></div>
          <div className="pwfb-verify-field"><span>Reference</span><strong style={{ wordBreak: 'break-all' }}>{reference}</strong></div>
          <div className="pwfb-verify-field"><span>Created</span><strong>{dateTime(transaction.createdAt)}</strong></div>
          <div className="pwfb-form-field-wide"><label className="pwfb-label">Description</label><div className="pwfb-input" style={{ minHeight: 80, whiteSpace: 'pre-wrap' }}>{transaction.description?.trim() || 'No description was provided.'}</div></div>
        </div>
      </section>

      <section className="pwfb-panel" style={{ marginTop: 18, border: '1px solid rgba(234, 88, 12, .35)' }}>
        <div className="pwfb-panel-header"><div><h2>How to Correct This Entry</h2><p>Do not change or delete the original ledger record.</p></div></div>
        <div style={{ padding: 18 }}>
          <div className="pwfb-verify-field" style={{ marginBottom: 14 }}><span>Step 1</span><strong>Keep the original transaction intact.</strong><small>It remains part of the audit trail.</small></div>
          <div className="pwfb-verify-field" style={{ marginBottom: 14 }}><span>Step 2</span><strong>Create a new correcting transaction.</strong><small>Use the correct customer, amount and transaction type.</small></div>
          <div className="pwfb-verify-field"><span>Step 3</span><strong>Reference the original transaction.</strong><small>Include the original reference in the correction description for reconciliation.</small></div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
            <Link href={`/transactions/view/${transaction.id}`} className="pwfb-secondary-button">View Original Receipt</Link>
            <Link href="/transactions/add" className="pwfb-primary-button">+ Create Correcting Entry</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
