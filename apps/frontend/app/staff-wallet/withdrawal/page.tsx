'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../../lib/api';

export default function StaffWalletWithdrawalPage() {
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('Staff wallet withdrawal');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setResult(null);
    try {
      if (!customerId.trim()) throw new Error('Customer ID is required.');
      const data = await apiRequest(`/banking/customers/${encodeURIComponent(customerId.trim())}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), description }),
      });
      setResult(data);
      setAmount('');
    } catch (err: any) { setError(err?.message || 'Withdrawal failed'); }
    finally { setSaving(false); }
  }

  return <main className="page"><header><div><small>PWFB STAFF WALLET</small><h1>Withdrawal</h1><p>Withdraw money from a PWFB customer's wallet.</p></div><Link href="/staff-wallet">← Staff Wallet</Link></header>
    <section className="card"><div className="badge">ROLE CONTROLLED</div><div className="notice">Withdrawal uses the existing PWFB wallet controls and balance validation. Bank payout remains subject to the configured banking provider.</div><form onSubmit={submit}>
      <label>Customer ID<input value={customerId} onChange={e => setCustomerId(e.target.value)} placeholder="Enter PWFB customer ID" required /></label>
      <label>Amount (₦)<input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" placeholder="0.00" required /></label>
      <label>Description<input value={description} onChange={e => setDescription(e.target.value)} /></label>
      {error && <div className="error">{error}</div>}{result && <div className="success">Withdrawal completed. New balance: <b>₦{Number(result.wallet?.balance ?? 0).toLocaleString('en-NG',{minimumFractionDigits:2})}</b><br/>Reference: {result.transaction?.reference}</div>}
      <button disabled={saving}>{saving ? 'Processing...' : 'Withdraw'}</button>
    </form></section>
    <style jsx>{`.page{min-height:100vh;background:#f6f8f5;color:#173a2e;padding:24px;font-family:Arial,sans-serif}header{max-width:760px;margin:auto;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}small{color:#f28c28;font-weight:800}h1{margin:4px 0;font-size:30px}header p{color:#66736b}header a{background:#075c3a;color:#fff;padding:11px 15px;border-radius:8px;text-decoration:none;font-weight:700}.card{max-width:760px;margin:24px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 12px #0000000b}.badge{display:inline-block;background:#eaf7ef;color:#075c3a;padding:6px 9px;border-radius:999px;font-size:11px;font-weight:800;margin-bottom:12px}.notice{padding:12px;background:#fff7eb;border:1px solid #f5dfbf;border-radius:9px;font-size:12px;margin-bottom:18px}form{display:grid;gap:16px}label{display:grid;gap:7px;font-size:13px;font-weight:700}input{height:46px;border:1px solid #d3ddd7;border-radius:9px;padding:0 12px;font-size:15px}button{height:46px;border:0;border-radius:9px;background:#f28c28;color:#fff;font-weight:800;font-size:15px}button:disabled{opacity:.6}.error,.success{padding:12px;border-radius:9px;font-size:13px}.error{background:#fff0f0;color:#a51d1d}.success{background:#edf9f0;color:#075c3a}`}</style>
  </main>;
}
