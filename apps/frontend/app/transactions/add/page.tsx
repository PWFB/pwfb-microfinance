'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pwfbApi } from '../../../lib/pwfb-api';

interface Customer { id: string; firstName?: string; lastName?: string; }
const money = (value: number) => `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AddTransactionPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [type, setType] = useState('Deposit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      pwfbApi.customers.search(customerQuery.trim() || undefined).then((data) => {
        const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
        setCustomers(rows.slice(0, 8));
      }).catch(() => setCustomers([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [customerQuery]);

  const selected = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const numericAmount = Number(amount || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!customerId) return setError('Select a customer before saving the transaction.');
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter an amount greater than zero.');
    setSaving(true);
    try {
      const created = await pwfbApi.transactions.create({ customerId, type, amount: numericAmount, description: description.trim() || undefined });
      const record = created?.data && !created?.id ? created.data : created;
      if (!record?.id) throw new Error('Transaction was saved, but no transaction ID was returned by the PWFB server.');
      router.push(`/transactions/view/${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save transaction.');
    } finally { setSaving(false); }
  }

  return <main className="pwfb-banking-page">
    <div className="pwfb-page-header">
      <div><p className="pwfb-eyebrow">FINANCIAL OPERATIONS / TRANSACTION</p><h1 className="pwfb-page-title">Add Transaction</h1><p className="pwfb-page-description">Record a controlled financial ledger entry for a verified customer.</p></div>
      <Link href="/transactions" className="pwfb-secondary-button">← Transaction Overview</Link>
    </div>

    <section className="pwfb-banking-hero">
      <div className="pwfb-banking-step"><div className="pwfb-step-number">01</div><div><label>NEW TRANSACTION</label><h2 style={{ margin: 0, color: '#fff', fontSize: 24 }}>Create a ledger entry</h2><p style={{ margin: '6px 0 0', color: '#c9ead3', fontSize: 11 }}>Complete the customer, transaction type and amount. The record will be saved to the PWFB transaction ledger.</p></div></div>
      <div className="pwfb-banking-hero-note"><b>✓ Controlled entry</b><span>Wallet transactions are system-generated and are not created through this manual form.</span></div>
    </section>

    <form onSubmit={handleSubmit} className="pwfb-panel">
      <div className="pwfb-panel-header"><div><h2>Transaction Details</h2><p>Enter accurate information before submitting.</p></div><span className="pwfb-operation-badge">SECURE ENTRY</span></div>
      {error && <div className="pwfb-alert pwfb-alert-error">{error}</div>}
      <div className="pwfb-banking-form-grid">
        <div className="pwfb-form-field-wide">
          <label className="pwfb-label">Customer</label>
          <input className="pwfb-input" value={selected ? `${selected.firstName ?? ''} ${selected.lastName ?? ''}`.trim() : customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setCustomerId(''); }} placeholder="Search customer name or ID..." autoComplete="off" />
          {!selected && customers.length > 0 && <div style={{ marginTop: 7, border: '1px solid #dfe7e2', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>{customers.map((c) => <button type="button" key={c.id} onClick={() => { setCustomerId(c.id); setCustomerQuery(`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()); setCustomers([]); }} style={{ display: 'block', width: '100%', padding: '10px 12px', border: 0, borderBottom: '1px solid #edf1ee', background: '#fff', textAlign: 'left' }}><strong style={{ display: 'block', color: '#0a5c28', fontSize: 12 }}>{`${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'}</strong><small style={{ color: '#66736b' }}>{c.id}</small></button>)}</div>}
          {selected && <div className="pwfb-verify-field verified" style={{ marginTop: 8 }}><span>Customer selected: {selected.id}</span><b>✓</b></div>}
        </div>
        <div><label className="pwfb-label">Transaction Type</label><select className="pwfb-input" value={type} onChange={(e) => setType(e.target.value)}><option>Deposit</option><option>Withdrawal</option><option>Loan Disbursement</option><option>Loan Repayment</option><option>Transfer</option></select></div>
        <div><label className="pwfb-label">Amount</label><div className="pwfb-amount-input"><span>₦</span><input className="pwfb-input" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></div></div>
        <div className="pwfb-form-field-wide"><label className="pwfb-label">Description <span style={{ fontWeight: 500, color: '#8a968f' }}>(optional)</span></label><textarea className="pwfb-input" style={{ minHeight: 110, resize: 'vertical' }} placeholder="Add a clear transaction description or operational note..." value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      </div>
      <div className="pwfb-deposit-actions"><div className="pwfb-security-note">🔒 Transaction data is submitted through the authenticated PWFB API.</div><div style={{ display: 'flex', gap: 9 }}><Link href="/transactions" className="pwfb-secondary-button">Cancel</Link><button type="submit" className="pwfb-primary-button pwfb-banking-submit" disabled={saving}>{saving ? 'Saving...' : 'Save Transaction'}</button></div></div>
    </form>

    <section className="pwfb-panel" style={{ marginTop: 18 }}><div className="pwfb-panel-header"><div><h2>Entry Preview</h2><p>Review the transaction before saving.</p></div></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12, padding: 18 }}><div className="pwfb-verify-field"><span>Customer</span><strong>{selected ? `${selected.firstName ?? ''} ${selected.lastName ?? ''}`.trim() : 'Not selected'}</strong></div><div className="pwfb-verify-field"><span>Type</span><strong>{type}</strong></div><div className="pwfb-verify-field verified"><span>Amount</span><strong>{money(numericAmount)}</strong></div></div></section>
  </main>;
}
