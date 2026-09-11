'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { pwfbApi } from '../../../../lib/pwfb-api';

interface Transaction {
  id: string;
  customerId?: string;
  customer?: { id?: string; firstName?: string; lastName?: string; phone?: string; email?: string } | null;
  type?: string;
  amount?: number | string;
  description?: string | null;
  status?: string;
  source?: string;
  provider?: string | null;
  providerReference?: string | null;
  reference?: string | null;
  processedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  walletBalanceBefore?: number | string | null;
  walletBalanceAfter?: number | string | null;
  failureReason?: string | null;
}

const money = (value: number | string | null | undefined) =>
  `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function ViewTransactionPage() {
  const params = useParams();
  const id = String(params?.id ?? '');
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError('');

    pwfbApi.transactions.get(id)
      .then((data) => {
        if (!active) return;
        const record = data?.data && !data?.id ? data.data : data;
        setTransaction(record ?? null);
        if (!record) setError('Transaction details could not be found.');
      })
      .catch((err) => {
        if (!active) return;
        setTransaction(null);
        setError(err instanceof Error ? err.message : 'Unable to load transaction details.');
      })
      .finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [id]);

  if (loading) {
    return <main className="pwfb-banking-page"><div className="pwfb-empty-state"><div className="pwfb-loading-dot" /><p>Loading transaction details...</p></div></main>;
  }

  if (!transaction) {
    return (
      <main className="pwfb-banking-page">
        <div className="pwfb-page-header">
          <div><p className="pwfb-eyebrow">FINANCIAL OPERATIONS / TRANSACTION</p><h1 className="pwfb-page-title">Transaction Details</h1><p className="pwfb-page-description">The selected transaction could not be loaded.</p></div>
          <Link href="/transactions" className="pwfb-secondary-button">← Transaction Overview</Link>
        </div>
        <section className="pwfb-panel"><div className="pwfb-empty-state"><div className="pwfb-empty-icon">!</div><h3>Transaction unavailable</h3><p>{error || 'No transaction record was returned by the PWFB API.'}</p><Link href="/transactions" className="pwfb-primary-button">Back to Transactions</Link></div></section>
      </main>
    );
  }

  const customerName = `${transaction.customer?.firstName ?? ''} ${transaction.customer?.lastName ?? ''}`.trim() || 'Customer';
  const reference = transaction.providerReference || transaction.reference || transaction.id;
  const isWallet = transaction.source === 'WALLET';

  return (
    <main className="pwfb-banking-page">
      <div className="pwfb-page-header">
        <div><p className="pwfb-eyebrow">FINANCIAL OPERATIONS / TRANSACTION</p><h1 className="pwfb-page-title">Transaction Details</h1><p className="pwfb-page-description">Complete transaction record and audit information.</p></div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <Link href="/transactions" className="pwfb-secondary-button">← Transaction Overview</Link>
          {!isWallet && <Link href={`/transactions/edit/${transaction.id}`} className="pwfb-primary-button">Edit Transaction</Link>}
        </div>
      </div>

      <section className="pwfb-banking-hero">
        <div className="pwfb-banking-step"><div className="pwfb-step-number">✓</div><div><label>TRANSACTION RECORD</label><h2 style={{ margin: 0, color: '#fff', fontSize: 24 }}>{money(transaction.amount)}</h2><p style={{ margin: '6px 0 0', color: '#c9ead3', fontSize: 11 }}>{transaction.type || 'Transaction'} • {customerName}</p></div></div>
        <div className="pwfb-banking-hero-note"><b>✓ {transaction.status || 'COMPLETED'}</b><span>{isWallet ? 'System-generated wallet transaction' : 'PWFB ledger transaction'}</span></div>
      </section>

      <section className="pwfb-panel" style={{ marginTop: 18 }}>
        <div className="pwfb-panel-header"><div><h2>Transaction Information</h2><p>Verified information returned from the PWFB transaction service.</p></div><span className="pwfb-operation-badge">{transaction.source || 'LEDGER'}</span></div>
        <div className="pwfb-banking-form-grid" style={{ padding: 18 }}>
          <div className="pwfb-verify-field verified"><span>Customer</span><strong>{customerName}</strong><small>{transaction.customerId || transaction.customer?.id || '—'}</small></div>
          <div className="pwfb-verify-field"><span>Transaction Type</span><strong>{transaction.type || '—'}</strong></div>
          <div className="pwfb-verify-field verified"><span>Amount</span><strong>{money(transaction.amount)}</strong></div>
          <div className="pwfb-verify-field"><span>Status</span><strong>{transaction.status || 'COMPLETED'}</strong></div>
          <div className="pwfb-verify-field"><span>Reference</span><strong style={{ wordBreak: 'break-all' }}>{reference}</strong></div>
          <div className="pwfb-verify-field"><span>Created</span><strong>{formatDate(transaction.createdAt)}</strong></div>
          <div className="pwfb-verify-field"><span>Processed</span><strong>{formatDate(transaction.processedAt || transaction.createdAt)}</strong></div>
          <div className="pwfb-verify-field"><span>Provider</span><strong>{transaction.provider || 'PWFB'}</strong></div>
          <div className="pwfb-verify-field"><span>Transaction ID</span><strong style={{ wordBreak: 'break-all' }}>{transaction.id}</strong></div>
          <div className="pwfb-form-field-wide"><label className="pwfb-label">Description</label><div className="pwfb-input" style={{ minHeight: 90, whiteSpace: 'pre-wrap' }}>{transaction.description?.trim() || 'No description was provided for this transaction.'}</div></div>
        </div>
      </section>

      {(transaction.walletBalanceBefore != null || transaction.walletBalanceAfter != null || transaction.failureReason) && (
        <section className="pwfb-panel" style={{ marginTop: 18 }}>
          <div className="pwfb-panel-header"><div><h2>Processing Information</h2><p>Additional system-generated transaction details.</p></div></div>
          <div className="pwfb-banking-form-grid" style={{ padding: 18 }}>
            {transaction.walletBalanceBefore != null && <div className="pwfb-verify-field"><span>Balance Before</span><strong>{money(transaction.walletBalanceBefore)}</strong></div>}
            {transaction.walletBalanceAfter != null && <div className="pwfb-verify-field"><span>Balance After</span><strong>{money(transaction.walletBalanceAfter)}</strong></div>}
            {transaction.failureReason && <div className="pwfb-form-field-wide"><label className="pwfb-label">Failure Reason</label><div className="pwfb-input">{transaction.failureReason}</div></div>}
          </div>
        </section>
      )}
    </main>
  );
}
